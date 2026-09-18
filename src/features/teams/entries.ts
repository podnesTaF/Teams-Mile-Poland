import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";

import { users } from "@/db/schema/auth";
import { eventRegistrations } from "@/db/schema/event-registrations";
import {
  teamEntries,
  teamEntryMembers,
  type TeamEntryMemberRow,
  type TeamEntryRow,
} from "@/db/schema/team-entries";
import { userTeamMembers, userTeams, type UserTeamRow } from "@/db/schema/user-teams";
import { getTeamAcerBalance, recordWalletTransaction } from "@/features/wallet/data";
import { InsufficientAcerError } from "@/features/wallet/errors";
import { entryFeeRefundKey, refundEntryFee } from "@/features/wallet/refunds";
import { getDb } from "@/lib/db";
import { getAllEvents } from "@/lib/events/store";
import { acceptsTeams, type EventSummary } from "@/lib/events/types";

import { teamFailure, type TeamActionResult, type TeamRole, type TeamSex } from "./config";
import { RATING_RULES_VERSION } from "./rating-rules";

/**
 * Team entries — the reads and the transactional writes behind the entry
 * actions (PRD #64, slice #67).
 *
 * The split mirrors `roster-service.ts`: **everything here is already past the
 * gate**. `actions/entries.ts` runs `requireTeamManagerOrAdmin`, decides the
 * refusals that need an event or a roster to judge, and then calls these with
 * the rows it was handed. The reason for the split is the same as #62's — a
 * transaction body that can be exercised from a verification script without
 * forging a session — plus one more that matters here: #69's team check-in
 * writes the *same* `team_entry_members` rows, and it must read them through
 * the same helpers rather than growing its own queries.
 *
 * Not a `"use server"` module: it exports types, plain functions and row
 * writers, none of which are server actions.
 *
 * The one thing this module deliberately does **not** do is send mail. Mail is
 * `mail-entries.ts`, called from the actions after the write, because a mail
 * failure must never roll back an entry that already exists.
 */

/**
 * Race role and stage option, derived from the row type rather than re-declared.
 * The schema types them from `rating-rules.ts`; deriving here keeps this file
 * from becoming a second place they could drift.
 */
export type EntryRaceRole = NonNullable<TeamEntryMemberRow["raceRole"]>;
export type EntryStageOption = NonNullable<TeamEntryMemberRow["stageOption"]>;

/**
 * One member of an entry, as the entry page, the admin desk (#69) and the
 * confirmation screen (#68) all need them: the seat, the account and the
 * registration in one row.
 *
 * `confirmed` is `consent_pending = false` and nothing else (PRD #64,
 * Cross-Cutting Decision 3) — there is no second definition anywhere.
 */
export type EntryMemberView = {
  /** `team_entry_members.id`. */
  seatId: string;
  userId: string;
  registrationId: string;
  /** First + last, falling back to the account name and then the email. */
  displayName: string;
  /** First name alone, for a mail greeting. */
  firstName: string;
  email: string;
  /** `users.locale` verbatim; `asTeamMailLocale` narrows it at the send site. */
  locale: string;
  sex: TeamSex | null;
  dateOfBirth: Date | null;
  /** The member still has to open their link and tick. */
  consentPending: boolean;
  /** True when they have — the inverse, spelled out so no caller re-derives it. */
  confirmed: boolean;
  bib: number | null;
  raceRole: EntryRaceRole | null;
  pairNo: number | null;
  stageOption: EntryStageOption | null;
  isReserve: boolean;
};

/** An entry with its confirmation counts — one line of a list surface. */
export type EntrySummary = {
  entry: TeamEntryRow;
  /** Members on the entry. */
  total: number;
  /** Of those, how many have confirmed (`consent_pending = false`). */
  confirmed: number;
};

/** {@link EntrySummary} plus the team, for the organiser's per-event list (#69). */
export type EventEntrySummary = EntrySummary & { team: UserTeamRow };

/* ------------------------------------------------------------------ reads */

export async function getEntry(entryId: string): Promise<TeamEntryRow | null> {
  const db = getDb();
  const rows = await db.select().from(teamEntries).where(eq(teamEntries.id, entryId)).limit(1);
  return rows[0] ?? null;
}

/**
 * The entry *and* its team in one query — what every entry-id-keyed action
 * needs, because the manager gate (`requireTeamManagerOrAdmin`) is keyed by the
 * team's slug and an action only ever receives the entry id.
 */
export async function getEntryWithTeam(
  entryId: string,
): Promise<{ entry: TeamEntryRow; team: UserTeamRow } | null> {
  const db = getDb();
  const rows = await db
    .select({ entry: teamEntries, team: userTeams })
    .from(teamEntries)
    .innerJoin(userTeams, eq(userTeams.id, teamEntries.teamId))
    .where(eq(teamEntries.id, entryId))
    .limit(1);
  return rows[0] ?? null;
}

/** The `already_entered` read: one entry per (team, event) by unique index. */
export async function getEntryByTeamAndEvent(
  teamId: string,
  eventSlug: string,
): Promise<TeamEntryRow | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(teamEntries)
    .where(and(eq(teamEntries.teamId, teamId), eq(teamEntries.eventSlug, eventSlug)))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Every entry this team has, newest first, with its confirmation counts — the
 * "Entries" list on the team page.
 *
 * Two queries regardless of how many entries (the same shape as `getMyTeams`):
 * the entries, then one grouped count over their members. A per-entry count
 * would be n+1 on a surface a manager reloads all evening.
 */
export async function listEntriesForTeam(teamId: string): Promise<EntrySummary[]> {
  const db = getDb();
  const entries = await db
    .select()
    .from(teamEntries)
    .where(eq(teamEntries.teamId, teamId))
    .orderBy(asc(teamEntries.createdAt));
  return withCounts(entries);
}

/**
 * Every entry for one event with its team and confirmation counts — the
 * organiser's desk list (#69) and the public entered-teams count's detail view.
 */
export async function listEntriesForEvent(eventSlug: string): Promise<EventEntrySummary[]> {
  const db = getDb();
  const rows = await db
    .select({ entry: teamEntries, team: userTeams })
    .from(teamEntries)
    .innerJoin(userTeams, eq(userTeams.id, teamEntries.teamId))
    .where(eq(teamEntries.eventSlug, eventSlug))
    .orderBy(asc(teamEntries.createdAt));

  const counts = await withCounts(rows.map((row) => row.entry));
  const byEntry = new Map(counts.map((summary) => [summary.entry.id, summary]));
  return rows.map((row) => ({
    entry: row.entry,
    team: row.team,
    total: byEntry.get(row.entry.id)?.total ?? 0,
    confirmed: byEntry.get(row.entry.id)?.confirmed ?? 0,
  }));
}

/**
 * How many teams have entered — the one number the public event page shows for
 * a team event (PRD #64, user story 1).
 *
 * A `count(*)`, not a list: the page is statically generated and must not read
 * (let alone render) anybody's roster. Returns 0 when the database is
 * unreachable, matching `store.ts`'s "a failed read degrades to empty rather
 * than taking the build down" — an SSG page for a team event must still build.
 */
export async function countEntriesForEvent(eventSlug: string): Promise<number> {
  try {
    const db = getDb();
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(teamEntries)
      .where(eq(teamEntries.eventSlug, eventSlug));
    return row?.n ?? 0;
  } catch (error) {
    console.error(`[teams] entered-teams count failed for ${eventSlug}:`, error);
    return 0;
  }
}

/** The counts for a set of entries in one grouped query. */
async function withCounts(entries: TeamEntryRow[]): Promise<EntrySummary[]> {
  if (entries.length === 0) return [];
  const db = getDb();
  const rows = await db
    .select({
      entryId: teamEntryMembers.entryId,
      total: sql<number>`count(*)::int`,
      confirmed: sql<number>`count(*) filter (where ${eventRegistrations.consentPending} = false)::int`,
    })
    .from(teamEntryMembers)
    .innerJoin(eventRegistrations, eq(eventRegistrations.id, teamEntryMembers.registrationId))
    .where(
      inArray(
        teamEntryMembers.entryId,
        entries.map((entry) => entry.id),
      ),
    )
    .groupBy(teamEntryMembers.entryId);

  const byEntry = new Map(rows.map((row) => [row.entryId, row]));
  return entries.map((entry) => ({
    entry,
    total: byEntry.get(entry.id)?.total ?? 0,
    confirmed: byEntry.get(entry.id)?.confirmed ?? 0,
  }));
}

/**
 * Every member of an entry, in the order they were entered, joined to their
 * account and their registration.
 *
 * This is the read behind the checklist, the reminder clock, the withdrawal
 * mailing list and (#69) the composition editor's roster — one shape, so those
 * four cannot disagree about who is on the entry or who has confirmed. It
 * carries email addresses and dates of birth, so it is for the manager, the
 * organiser and mail: never for a public surface.
 */
export async function getEntryMembers(entryId: string): Promise<EntryMemberView[]> {
  const db = getDb();
  const rows = await db
    .select({
      seatId: teamEntryMembers.id,
      userId: teamEntryMembers.userId,
      registrationId: teamEntryMembers.registrationId,
      raceRole: teamEntryMembers.raceRole,
      pairNo: teamEntryMembers.pairNo,
      stageOption: teamEntryMembers.stageOption,
      isReserve: teamEntryMembers.isReserve,
      createdAt: teamEntryMembers.createdAt,
      firstName: users.firstName,
      lastName: users.lastName,
      name: users.name,
      email: users.email,
      locale: users.locale,
      sex: users.sex,
      dateOfBirth: users.dateOfBirth,
      consentPending: eventRegistrations.consentPending,
      bib: eventRegistrations.bib,
      bibReturnedAt: eventRegistrations.bibReturnedAt,
    })
    .from(teamEntryMembers)
    .innerJoin(users, eq(users.id, teamEntryMembers.userId))
    .innerJoin(eventRegistrations, eq(eventRegistrations.id, teamEntryMembers.registrationId))
    .where(eq(teamEntryMembers.entryId, entryId))
    .orderBy(asc(teamEntryMembers.createdAt));

  return rows.map((row) => {
    const displayName =
      [row.firstName, row.lastName].filter(Boolean).join(" ").trim() || row.name || row.email;
    return {
      seatId: row.seatId,
      userId: row.userId,
      registrationId: row.registrationId,
      displayName,
      firstName: row.firstName?.trim() || displayName.split(" ")[0] || row.email,
      email: row.email,
      locale: row.locale,
      sex: (row.sex ?? null) as TeamSex | null,
      dateOfBirth: coerceDob(row.dateOfBirth),
      consentPending: row.consentPending,
      confirmed: !row.consentPending,
      // A bib is a lease (ADR 0003): the number is retained after it returns to
      // the pool, so a swapped-out reserve must not read as still wearing it.
      bib: row.bibReturnedAt ? null : row.bib,
      raceRole: row.raceRole,
      pairNo: row.pairNo,
      stageOption: row.stageOption,
      isReserve: row.isReserve,
    };
  });
}

/**
 * `users.date_of_birth` is a Drizzle `date` column, which comes back as a `Date`
 * or a `YYYY-MM-DD` string depending on the driver's mode. Normalised here so
 * the age check has one input shape; `coerceToDate` in `@/lib/age` is the
 * function that knows how, and this only narrows the `unknown`.
 */
function coerceDob(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return new Date(value);
  return null;
}

/**
 * A roster member as the *entry* gate judges them: the eligibility fields
 * (`userId`, `sex`, `role`) that `entryShortfall` reads, plus the two the
 * roster reads never carried — the **date of birth**, because entry checks 18
 * on the event date rather than today, and the **locale**, which is copied onto
 * the registration so the ticket and every later mailing speak the member's
 * language.
 *
 * Structurally a `RosterSeat` (`eligibility.ts`), so it can be handed straight
 * to `entryShortfall` without a mapping step.
 */
export type EntryCandidate = {
  userId: string;
  role: TeamRole;
  sex: TeamSex | null;
  dateOfBirth: Date | null;
  displayName: string;
  email: string;
  locale: string;
};

/**
 * The whole roster in the shape the entry gate needs, manager first then by
 * join order — one query.
 *
 * Deliberately separate from `data.ts`'s `getTeamRoster`: that helper feeds the
 * on-page roster and carries no date of birth and no locale, and widening it
 * would hand every formation surface two more personal fields it has no use
 * for. `addEntryMember` reuses this and filters by id, so "is this person on
 * the roster" and "is the roster complete" read the same rows.
 */
export async function getTeamEntryCandidates(teamId: string): Promise<EntryCandidate[]> {
  const db = getDb();
  const rows = await db
    .select({
      userId: userTeamMembers.userId,
      role: userTeamMembers.role,
      joinedAt: userTeamMembers.joinedAt,
      sex: users.sex,
      dateOfBirth: users.dateOfBirth,
      firstName: users.firstName,
      lastName: users.lastName,
      name: users.name,
      email: users.email,
      locale: users.locale,
    })
    .from(userTeamMembers)
    .innerJoin(users, eq(users.id, userTeamMembers.userId))
    .where(eq(userTeamMembers.teamId, teamId))
    .orderBy(asc(userTeamMembers.joinedAt));

  // Sorted on the rows (which still carry `joinedAt`) and mapped afterwards, so
  // the candidate type stays exactly what callers need and nothing has to be
  // stripped back off it. Manager first, then join order — the same order
  // `getTeamRoster` returns, so the entry page and the team page agree.
  return [...rows]
    .sort((a, b) => {
      if (a.role !== b.role) return a.role === "manager" ? -1 : 1;
      return a.joinedAt.getTime() - b.joinedAt.getTime();
    })
    .map((row) => ({
      userId: row.userId,
      role: row.role,
      sex: (row.sex ?? null) as TeamSex | null,
      dateOfBirth: coerceDob(row.dateOfBirth),
      displayName:
        [row.firstName, row.lastName].filter(Boolean).join(" ").trim() || row.name || row.email,
      email: row.email,
      locale: row.locale,
    }));
}

/**
 * Team events currently taking entries, soonest first — what the team page
 * offers an "Enter" button for.
 *
 * `registration_open` only, and the frozen legacy TEAMS MILE night filtered out
 * by `isSeriesEvent`: its entry flow is the untouched `teams`/`runners` stack
 * (ADR 0008), and offering a manager an Enter button for it would write
 * `team_entries` rows nothing reads.
 */
export async function getOpenTeamEvents(): Promise<EventSummary[]> {
  const all = await getAllEvents();
  return all
    .filter((event) => acceptsTeams(event) && event.status === "registration_open")
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Which of `userIds` already hold an **individual** registration for the event —
 * a row with no `team_entry_id`.
 *
 * The mixed-night rule (ADR 0009): a runner is either registered alone or
 * entered by a team, never both. `upsertMemberRegistration` below resolves the
 * unique `(event_slug, user_id)` conflict by adopting the existing row into the
 * entry, which is right when the row is a stale seat from a withdrawn entry and
 * wrong when it is a registration the runner made themselves — so the entry
 * actions ask here first and refuse by name.
 */
export async function findIndividuallyRegistered(
  eventSlug: string,
  userIds: string[],
): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  const db = getDb();
  const rows = await db
    .select({ userId: eventRegistrations.userId })
    .from(eventRegistrations)
    .where(
      and(
        eq(eventRegistrations.eventSlug, eventSlug),
        inArray(eventRegistrations.userId, userIds),
        isNull(eventRegistrations.teamEntryId),
      ),
    );
  return new Set(rows.map((row) => row.userId));
}

/* ----------------------------------------------------------------- writers */

/**
 * The idempotency key of an entry's fee row — the natural key on the causing
 * fact, which is the entry itself (ADR 0013).
 *
 * A function rather than a literal at the two call sites, because slice 5's
 * refund finds the fee row *by this key* to know what to give back and to set
 * `reverses_id` on: a fee written under one spelling and looked up under
 * another would silently refund nothing. One definition, both directions.
 */
export function teamEntryFeeKey(entryId: string): string {
  return `team_entry_fee:${entryId}`;
}

/** A roster member as the entry writer needs them: an account and a language. */
export type EntrySeatInput = {
  userId: string;
  /** `users.locale`, copied onto the registration so mail and the ticket match. */
  locale: string;
};

/**
 * Create the entry, one registration per member and one seat per member —
 * **all in one transaction** (PRD #64, "Entry creates real registrations"; the
 * issue's "a failure anywhere writes nothing").
 *
 * The registrations are ordinary rows: `status = 'registered'`, a real locale,
 * `terms = false` because no consent has been captured (ADR 0006 — the
 * deprecated column is never written as a literal `true` again). The only two
 * team-shaped values on them are `consent_pending = true` and the
 * `team_entry_id` back-link.
 *
 * **Pre-existing registrations are adopted, not refused.** A team event has no
 * per-person register flow, so the only way a member can already hold a
 * registration for the night is an admin having created one by hand — and
 * `event_registrations_event_user_uq` would abort the whole transaction over
 * it. The upsert therefore links that row to the entry and *leaves
 * `consent_pending` alone*: a runner who already registered has already
 * consented, and flipping them back to pending would demand a second Statement
 * for the same race. New rows get `true`, adopted rows keep whatever they had.
 *
 * **The fee joins that transaction** (ADR 0013). A priced night is paid from
 * the **team's treasury**, because the team is the ledger owner of a team fact
 * (ADR 0012) — never from the manager's own wallet, which would make a refund
 * ambiguous the moment the manager changes. Entry, registrations, seats and
 * debit land together or not at all: an entry without its debit is a free
 * place, and a debit without its entry is money taken for nothing.
 *
 * **The balance race**, exactly as `createTeamRows` describes it for a wallet:
 * there is no stored balance to `UPDATE … WHERE balance >= fee`, so two Enters
 * by one team (a double-click, two tabs, a manager and an admin) could each
 * read the same `SUM` and both pass. The `user_teams` row lock is the
 * per-treasury mutex and the balance is re-read *under* it.
 *
 * **Why `FOR NO KEY UPDATE` and not `FOR UPDATE`.** It is the payer mode
 * `transfers.ts` sets out, and the reason applies verbatim here: it excludes
 * another spend on the same treasury (a payout, a second entry) but not the
 * `FOR KEY SHARE` a *credit* landing on the team takes, so a member
 * contributing the money for this very entry never queues behind it. It also
 * keeps this path off the `users` table entirely — the registration inserts
 * take only the FK's `KEY SHARE` on `users`, which conflicts with nothing a
 * contribution holds — so the "acquire `users` before `user_teams`" ordering
 * rule never comes into play and there is no cycle to deadlock on.
 *
 * **The shortfall is thrown, not returned**, unlike every other refusal in this
 * module. Drizzle commits whatever the callback *returns*, so a `teamFailure`
 * is only an abort by luck of where it sits, and the guarantee this transaction
 * exists to make is that a refusal writes nothing — including the seat loop's
 * rows, if a concurrent spend empties the treasury between two entries. The
 * sentinel is `InsufficientAcerError`, the same one `createTeamRows` throws for
 * a wallet, and `enterTeam` maps it back to an ordinary `treasury_insufficient`
 * refusal so no caller ever sees an exception.
 */
export async function createEntryRows({
  team,
  eventSlug,
  actorUserId,
  seats,
  feeMinor,
}: {
  team: UserTeamRow;
  eventSlug: string;
  /** Whoever pressed Enter — the manager, or an admin acting for the team. */
  actorUserId: string;
  seats: EntrySeatInput[];
  /**
   * What this night costs, in ACER minor units, as a **positive** number; the
   * ledger row carries the minus. `0` skips the debit entirely rather than
   * writing a zero-amount row. Passed in rather than read off the event here,
   * so the action prices the night once — the same number it pre-checked the
   * treasury against — and a re-pricing mid-request cannot charge one figure
   * against a balance judged by another.
   */
  feeMinor: number;
}): Promise<TeamActionResult<{ entryId: string; registrationIds: Map<string, string> }>> {
  if (seats.length === 0) return teamFailure("incomplete_team");

  const db = getDb();

  return db.transaction(async (tx) => {
    if (feeMinor > 0) {
      // The lock, not the read, is what serialises two entries; the row is
      // selected only to take it.
      await tx
        .select({ id: userTeams.id })
        .from(userTeams)
        .where(eq(userTeams.id, team.id))
        .for("no key update");

      const treasuryMinor = await getTeamAcerBalance(team.id, tx);
      if (treasuryMinor < feeMinor) throw new InsufficientAcerError(feeMinor, treasuryMinor);
    }

    const [entry] = await tx
      .insert(teamEntries)
      .values({
        teamId: team.id,
        eventSlug,
        category: team.category,
        enteredByUserId: actorUserId,
        ratingRulesVersion: RATING_RULES_VERSION,
        status: "entered",
      })
      .returning({ id: teamEntries.id });

    const registrationIds = new Map<string, string>();
    for (const seat of seats) {
      const registrationId = await upsertMemberRegistration(tx, {
        entryId: entry.id,
        eventSlug,
        seat,
      });
      registrationIds.set(seat.userId, registrationId);
      await tx.insert(teamEntryMembers).values({
        entryId: entry.id,
        userId: seat.userId,
        registrationId,
      });
    }

    if (feeMinor > 0) {
      // Keyed by the entry, which was minted in this transaction — so the key
      // is unique by construction, a retry of this exact entry could never
      // charge twice, and slice 5's refund has one handle to find the fee row
      // by. `created_by` records the person who pressed Enter even though the
      // money is the team's: the treasury history has to name who spent it.
      await recordWalletTransaction(
        {
          teamId: team.id,
          asset: "ACER",
          amountMinor: -feeMinor,
          kind: "team_entry_fee",
          reference: `event:${eventSlug}`,
          createdBy: actorUserId,
          idempotencyKey: teamEntryFeeKey(entry.id),
        },
        tx,
      );
    }

    return { ok: true, entryId: entry.id, registrationIds };
  });
}

/**
 * The per-member half of {@link createEntryRows}, reused verbatim by
 * {@link addMemberRows} so a late recruit's registration is written exactly the
 * way the original seven were. `tx` is the transaction executor; the type is
 * taken from the transaction callback so it accepts both a `db` and a `tx`.
 */
type Executor = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

async function upsertMemberRegistration(
  tx: Executor,
  {
    entryId,
    eventSlug,
    seat,
  }: { entryId: string; eventSlug: string; seat: EntrySeatInput },
): Promise<string> {
  const [row] = await tx
    .insert(eventRegistrations)
    .values({
      eventSlug,
      userId: seat.userId,
      status: "registered",
      locale: seat.locale,
      consentPending: true,
      teamEntryId: entryId,
    })
    .onConflictDoUpdate({
      target: [eventRegistrations.eventSlug, eventRegistrations.userId],
      // Only the back-link. `consent_pending` is deliberately absent: see the
      // "adopted, not refused" paragraph on `createEntryRows`.
      set: { teamEntryId: entryId },
    })
    .returning({ id: eventRegistrations.id });
  return row.id;
}

/**
 * Add one member to an existing entry: a registration and a seat, in one
 * transaction (PRD #64, user story 10 — a recruit who joined after entry).
 *
 * Every refusal this could produce — not on the roster, already on the entry,
 * under 18 on the event date, entry already checked in — is decided by the
 * action, which has the roster and the event; by the time we are here the add
 * is legal.
 *
 * **No fee, on purpose** (ADR 0013, and the plan's decision table). The entry
 * fee is per team per night, not per head: the team bought its place when it
 * entered, and this only says who is standing in it. Charging here would also
 * make the refund unanswerable — one entry would have paid N different fees at
 * N different prices. Do not "fix" the missing debit; there is nothing to fix.
 */
export async function addMemberRows({
  entryId,
  eventSlug,
  seat,
}: {
  entryId: string;
  eventSlug: string;
  seat: EntrySeatInput;
}): Promise<TeamActionResult<{ registrationId: string }>> {
  const db = getDb();
  return db.transaction(async (tx) => {
    const registrationId = await upsertMemberRegistration(tx, { entryId, eventSlug, seat });
    await tx
      .insert(teamEntryMembers)
      .values({ entryId, userId: seat.userId, registrationId });
    return { ok: true, registrationId };
  });
}

/**
 * Remove one member from an entry: the seat **and** their registration.
 *
 * Deleting the registration is the point, not a side effect. A seat alone would
 * leave the dropped-out runner with a `consent_pending` registration for a race
 * they are not in — showing "awaiting your confirmation" on their profile
 * forever and counting against the desk's checklist. The registration's own
 * cascades take the consent rows and the email log with it, exactly as
 * withdrawal does.
 *
 * Returns `notfound` for a user who is not on the entry, rather than a silent
 * success, so the manager's UI can say so.
 */
export async function removeMemberRows(
  entryId: string,
  userId: string,
): Promise<TeamActionResult<{ registrationId: string }>> {
  const db = getDb();
  const [seat] = await db
    .select({ registrationId: teamEntryMembers.registrationId })
    .from(teamEntryMembers)
    .where(and(eq(teamEntryMembers.entryId, entryId), eq(teamEntryMembers.userId, userId)))
    .limit(1);
  if (!seat) return teamFailure("notfound");

  await db.transaction(async (tx) => {
    await tx
      .delete(teamEntryMembers)
      .where(and(eq(teamEntryMembers.entryId, entryId), eq(teamEntryMembers.userId, userId)));
    await tx.delete(eventRegistrations).where(eq(eventRegistrations.id, seat.registrationId));
  });

  return { ok: true, registrationId: seat.registrationId };
}

/**
 * Whether withdrawing from this night gives the entry fee back (ADR 0013
 * decision 6).
 *
 * `registration_open` and nothing else. The rule is about what the organiser
 * can still sell: the place a withdrawal releases can be taken by somebody else
 * while entries are open, and cannot once they are closed, so after that the fee
 * is forfeited. Cancellation is not this question — a cancelled night refunds
 * everything it took, and `refundEventFees` answers for it.
 *
 * A function rather than a comparison at the two call sites, because the action
 * that takes the money back and the page that tells the manager it will must
 * never disagree: a Withdraw button promising a refund that the action then
 * declines to pay is the one bug this note exists to prevent. An event that
 * cannot be resolved at all is not open, and so is not refundable — the money is
 * gone either way, and inventing a credit for a night nobody can name is worse
 * than forfeiting one.
 */
export function refundsOnWithdrawal(
  event: Pick<EventSummary, "status"> | null | undefined,
): boolean {
  return event?.status === "registration_open";
}

/**
 * Withdraw: delete the entry and every member registration, **and give the fee
 * back when the caller says the night still allows it** — in one transaction.
 *
 * A hard delete, like dissolve (PRD #64 Implementation Decisions, "hard
 * operations, no soft state"): there is no `withdrawn` status to filter out of
 * every later query, and the place is released immediately. The cascades do
 * most of the work — `team_entry_members` dies with the entry, and the consent
 * rows and the `event_email_log` rows die with the registrations.
 *
 * The registration ids must therefore be **collected and mailed before** this
 * runs; the action does that (see `withdrawEntry`). Takes them as an argument
 * rather than re-reading, so the rows deleted are exactly the rows mailed.
 *
 * **The refund joins this transaction**, so the entry ceasing to exist and the
 * treasury getting its ACER back are one fact. The alternative — credit after
 * the delete — has a window in which the place is released and the money is
 * still spent, and a crash inside it leaves a manager with neither, which is the
 * shape of complaint nobody can answer from the ledger afterwards.
 *
 * **`refundFee` is required and is decided by the caller**, which has the event;
 * this layer deliberately grows no event lookup (see `refundsOnWithdrawal`,
 * which is the predicate the action applies). The team, though, is read here
 * from the entry being deleted rather than taken as an argument: the treasury
 * that gets the money back must be the one that paid, and that is a property of
 * this row, not something a caller should be trusted to pair correctly.
 *
 * Withdrawing an entry that is already gone stays a success that writes
 * nothing — the same contract as before fees existed — so a double-clicked
 * Withdraw is a no-op rather than a `notfound` the manager has to read. The
 * refund is keyed as well, so neither half can happen twice.
 */
export async function withdrawEntryRows(
  entryId: string,
  registrationIds: string[],
  {
    refundFee,
    actorUserId,
  }: {
    /** `refundsOnWithdrawal(event)` — whether the night still gives the fee back. */
    refundFee: boolean;
    /** Whoever pressed Withdraw; recorded on the refund row as its cause. */
    actorUserId?: string | null;
  },
): Promise<TeamActionResult<{ deletedRegistrations: number; refundedMinor: number }>> {
  const db = getDb();
  let refundedMinor = 0;

  await db.transaction(async (tx) => {
    if (refundFee) {
      const [entry] = await tx
        .select({ teamId: teamEntries.teamId, eventSlug: teamEntries.eventSlug })
        .from(teamEntries)
        .where(eq(teamEntries.id, entryId))
        .limit(1);
      if (entry) {
        // Before the delete, while the row is still there to be read. A free
        // night and an entry made before fees existed have no fee row, and
        // `refundEntryFee` reports that as a success — withdrawing from a free
        // night must not fail because there is nothing to give back.
        const refund = await refundEntryFee({
          owner: { teamId: entry.teamId },
          feeKey: teamEntryFeeKey(entryId),
          refundKey: entryFeeRefundKey(entryId),
          reference: `event:${entry.eventSlug}`,
          createdBy: actorUserId ?? null,
          tx,
        });
        refundedMinor = refund.amountMinor;
      }
    }

    await tx.delete(teamEntries).where(eq(teamEntries.id, entryId));
    if (registrationIds.length > 0) {
      await tx.delete(eventRegistrations).where(inArray(eventRegistrations.id, registrationIds));
    }
  });

  return { ok: true, deletedRegistrations: registrationIds.length, refundedMinor };
}
