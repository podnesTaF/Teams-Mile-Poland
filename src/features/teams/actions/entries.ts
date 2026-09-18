"use server";

import { revalidatePath } from "next/cache";

import type { TeamEntryRow } from "@/db/schema/team-entries";
import type { UserTeamRow } from "@/db/schema/user-teams";
import { getTeamAcerBalance } from "@/features/wallet/data";
import { teamEntryFeeMinor } from "@/features/wallet/entry-fees";
import { isInsufficientAcer } from "@/features/wallet/errors";
import { meetsMinParticipantAge, parseDateOnly } from "@/lib/age";
import { getEventBySlug } from "@/lib/events/registry";
import { isPubliclyVisible } from "@/lib/events/store";
import { acceptsTeams, type EventSummary } from "@/lib/events/types";

import { teamFailure, type TeamActionFailure } from "../config";
import { entryShortfall } from "../eligibility";
import {
  addMemberRows,
  createEntryRows,
  findIndividuallyRegistered,
  getEntryByTeamAndEvent,
  getEntryMembers,
  getEntryWithTeam,
  getTeamEntryCandidates,
  removeMemberRows,
  withdrawEntryRows,
} from "../entries";
import { requireTeamManagerOrAdmin } from "../guards";
import {
  lastConfirmRequestAt,
  sendConfirmRequestEmail,
  sendEntryWithdrawnEmail,
  type EntryMailEvent,
} from "../mail-entries";

/**
 * Team entry (#67): the five manager actions of PRD #64's Contracts —
 * `enterTeam`, `addEntryMember`, `removeEntryMember`, `withdrawEntry`,
 * `remindMember`.
 *
 * Each is gate → refusals → service → mail → result, exactly like
 * `actions/roster.ts`. The row work lives in `../entries`, the mail in
 * `../mail-entries`, and nothing here writes a query of its own.
 *
 * All five run `requireTeamManagerOrAdmin`, which already admits an admin
 * holding `edit` (the organiser's right to refuse admission is the manager's
 * withdraw button under a different session, PRD #64 user story 35) and refuses
 * `admin_checkin` / `admin_viewer` with `forbidden`. Nothing here is gated on
 * `checkin` — that capability belongs to #69's desk actions.
 *
 * **Mail is sent after the write and its failure never changes the result.**
 * The team is entered; telling the manager their entry failed because a mailbox
 * bounced would be a lie, and the failure is recorded in `event_email_log` with
 * its error so Remind has something to act on.
 */

/**
 * A refusal that can name what it is refusing over.
 *
 * The frozen failure shape (`{ ok: false, reason, message }`) is a *key*, not a
 * sentence, and `teams.reasons.incomplete_team` cannot say "two more needed"
 * without one. So two refusals carry a datum alongside the key — the issue asks
 * for `incomplete_team` "with the count needed" and `member_underage` "naming
 * the member" — and the copy for those detailed variants lives in
 * `teams.entry.*`, with `teams.reasons.*` as the fallback. No reason key was
 * added: the reason set is frozen in `config.ts` for all three slices.
 */
export type EntryFailure = TeamActionFailure & {
  /** `incomplete_team`: members still needed before the team could field a race composition. */
  missing?: number;
  /** `member_underage`: the member who will not be 18 on the event date;
   * `registered_individually`: the member already registered alone (ADR 0009). */
  memberName?: string;
  /**
   * `treasury_insufficient`: what the night costs and what the treasury holds,
   * both in ACER **minor units**, read together so they cannot disagree.
   *
   * Two numbers rather than one shortfall because that is what the copy asks
   * for — `teams.entry.insufficientDetail` interpolates the price *and* the
   * balance ("Entering costs 100 ACER and the treasury holds 40"), and a
   * manager who is short needs to know how much is already there before
   * deciding who chips in. The plan called this datum `shortfallMinor`; the
   * difference is `feeMinor - treasuryMinor` and is deliberately not carried,
   * because a derived third number is a third place for the arithmetic to
   * drift. The refusal itself is still just the key `treasury_insufficient` —
   * these travel beside it exactly as `missing` and `memberName` do.
   */
  feeMinor?: number;
  treasuryMinor?: number;
};

export type EntryActionResult<T = object> = ({ ok: true } & T) | EntryFailure;

/** 24 hours — the floor between two reminders to the same member. */
const REMIND_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** The event facts the two mails name, from the summary the action already holds. */
function toMailEvent(event: EventSummary): EntryMailEvent {
  return { slug: event.slug, name: event.name, date: event.date };
}

/**
 * The public event page shows the entered-teams count, and it is statically
 * generated (PRD #64, Cross-Cutting Decision 4) — so entering and withdrawing
 * have to push the new count out themselves.
 *
 * The route-pattern form covers pl/en/ua in one call, and covers every event's
 * page rather than one slug's, because `[slug]` is a pattern and not a value —
 * the same trade `revalidateEventSurfaces` makes and for the same reason. The
 * entry page itself is dynamic and needs no invalidation.
 */
function revalidateEntrySurfaces(): void {
  revalidatePath("/[locale]/events/[slug]", "page");
}

/**
 * The entry-id twin of `requireTeamManagerOrAdmin`, which is keyed by a team
 * *slug* while every action below receives only an entry id.
 *
 * Resolving the entry first also settles `notfound` before the gate runs, so a
 * bad id never reports itself as `forbidden` and vice versa.
 */
async function gateEntry(entryId: string): Promise<
  | {
      ok: true;
      entry: TeamEntryRow;
      team: UserTeamRow;
      userId: string;
      actingAsAdmin: boolean;
    }
  | TeamActionFailure
> {
  if (!entryId || typeof entryId !== "string") return teamFailure("invalid");

  const found = await getEntryWithTeam(entryId);
  if (!found) return teamFailure("notfound");

  const gate = await requireTeamManagerOrAdmin(found.team.slug);
  if (!gate.ok) return gate;

  return {
    ok: true,
    entry: found.entry,
    team: found.team,
    userId: gate.userId,
    actingAsAdmin: gate.actingAsAdmin,
  };
}

/**
 * Resolve an event slug to a **team event that can still be acted on**: it
 * exists, it is not the frozen legacy night, and it is publicly visible.
 *
 * A `draft` is `notfound` here for the same reason it 404s on every public
 * surface: it has not been announced, so from outside `/admin` it does not
 * exist. Lifecycle refusals past that point (`cancelled`, `not_open`) differ per
 * action and stay at the call sites.
 */
async function loadTeamEvent(eventSlug: string): Promise<EventSummary | null> {
  const event = await getEventBySlug(eventSlug);
  if (!event) return null;
  if (!acceptsTeams(event) || !isPubliclyVisible(event)) return null;
  return event;
}

/**
 * Enter a team into an open team event.
 *
 * The guard order is the issue's, and it is the order a human would explain a
 * refusal in: you are not the manager → that night does not exist → it is
 * cancelled → it is not taking entries → you are already in it → your team
 * could not field a race composition yet → this member will not be 18 on the
 * night → one of them is already registered alone → the treasury cannot pay
 * for it. The fee is last because it is the only refusal the manager can fix
 * with money rather than with the roster, and it is worth fixing only once
 * everything else about the entry is legal.
 *
 * The size check is the *only* one the platform makes on a roster (ADR 0011):
 * `entryShortfall` reads the composition (`COMPOSITION` in `rating-rules.ts`),
 * because a team that cannot name its RACERS and pairs cannot start, and
 * entering it would mint registrations nobody can check in.
 *
 * Age is checked against **the event date**, not today (PRD #64, Cross-Cutting
 * Decision; brief Decision 7). Formation's stricter "18 today" lives in
 * `requireTeamActor` and is about who may be recruited at all; this one is
 * about who may race, and a 17-year-old on the roster in September can be a
 * legitimate entry for a race in November.
 */
export async function enterTeam(
  teamSlug: string,
  eventSlug: string,
): Promise<EntryActionResult<{ entryId: string }>> {
  const gate = await requireTeamManagerOrAdmin(teamSlug);
  if (!gate.ok) return gate;
  const team = gate.team;

  const event = await loadTeamEvent(eventSlug);
  if (!event) return teamFailure("notfound");
  if (event.status === "cancelled") return teamFailure("cancelled");
  if (event.status !== "registration_open") return teamFailure("not_open");

  if (await getEntryByTeamAndEvent(team.id, eventSlug)) return teamFailure("already_entered");

  const roster = await getTeamEntryCandidates(team.id);
  const shortfall = entryShortfall(team.category, roster);
  if (shortfall > 0) {
    return { ...teamFailure("incomplete_team"), missing: shortfall };
  }

  const eventDate = parseDateOnly(event.date);
  const underage = roster.find(
    (member) => !member.dateOfBirth || !meetsMinParticipantAge(member.dateOfBirth, eventDate),
  );
  if (underage) {
    return { ...teamFailure("member_underage"), memberName: underage.displayName };
  }

  // One entry path per runner per night (ADR 0009): on a mixed night a member
  // who already registered alone is named, and the manager sorts it out with
  // them — the platform never silently converts their registration.
  const solo = await findIndividuallyRegistered(
    eventSlug,
    roster.map((member) => member.userId),
  );
  const soloMember = roster.find((member) => solo.has(member.userId));
  if (soloMember) {
    return { ...teamFailure("registered_individually"), memberName: soloMember.displayName };
  }

  // Money last, and deliberately so. Every refusal above is about whether this
  // team may enter at all; this one is about whether it can afford to, and a
  // manager sent to raise 100 ACER for an entry their roster could not make
  // anyway has been sent on an errand. Priced off the event through
  // `teamEntryFeeMinor` and never off the column, so the button, this check and
  // the debit are the same number; read once here and handed down, so a
  // re-pricing mid-request cannot charge a figure the balance was not judged
  // against. The pre-check is a courtesy — it turns the everyday case into a
  // message instead of a rollback — and `createEntryRows`' read under the
  // treasury's lock is what actually makes it true.
  const feeMinor = teamEntryFeeMinor(event);
  if (feeMinor > 0) {
    const treasuryMinor = await getTeamAcerBalance(team.id);
    if (treasuryMinor < feeMinor) {
      return { ...teamFailure("treasury_insufficient"), feeMinor, treasuryMinor };
    }
  }

  let created;
  try {
    created = await createEntryRows({
      team,
      eventSlug,
      actorUserId: gate.userId,
      seats: roster.map((member) => ({ userId: member.userId, locale: member.locale })),
      feeMinor,
    });
  } catch (error) {
    // The race the pre-check cannot close: a payout or a second Enter emptied
    // the treasury between the two reads. The transaction rolled back, so the
    // manager gets the same refusal they would have got a moment earlier — with
    // the balance re-read now rather than the stale one they were refused on.
    if (isInsufficientAcer(error)) {
      return {
        ...teamFailure("treasury_insufficient"),
        feeMinor,
        treasuryMinor: await getTeamAcerBalance(team.id),
      };
    }
    throw error;
  }
  if (!created.ok) return created;

  // Read the seats back rather than reusing `roster`: `getEntryMembers` is the
  // one shape that carries the registration id the confirmation link is built
  // from, and it is the shape the checklist and #69's desk read too.
  for (const member of await getEntryMembers(created.entryId)) {
    await sendConfirmRequestEmail({ variant: "entry", member, team, event: toMailEvent(event) });
  }

  revalidateEntrySurfaces();
  return { ok: true, entryId: created.entryId };
}

/**
 * Add a member who joined the team after the entry was made (user story 10).
 *
 * They must be on the team's roster and not already on the entry, and they must
 * be 18 on the event date like everyone else. They receive the same
 * confirmation link as the original members, with the `added` opening line.
 *
 * **Free, even on a priced night** (ADR 0013). The fee is per team per night,
 * not per head — the team bought its place at `enterTeam` and this only says
 * who is standing in it. There is no balance check here and no debit, and
 * `addMemberRows` is deliberately not given a `feeMinor`: see its docblock.
 *
 * Allowed while the event is `registration_closed`, and only refused once the
 * team is `checked_in`. Adding a runner is not "a new entry" in the sense
 * Cross-Cutting Decision 3 closes — the team's place is already taken, and the
 * roster fact this reflects (somebody joined, somebody dropped out) does not
 * stop happening when the entry list does. What genuinely fixes the composition
 * is check-in, which is where the refusal is.
 */
export async function addEntryMember(
  entryId: string,
  userId: string,
): Promise<EntryActionResult> {
  const gate = await gateEntry(entryId);
  if (!gate.ok) return gate;
  if (!userId || typeof userId !== "string") return teamFailure("invalid");
  if (gate.entry.status !== "entered") return teamFailure("already_checked_in");

  const event = await loadTeamEvent(gate.entry.eventSlug);
  if (!event) return teamFailure("notfound");
  if (event.status === "cancelled") return teamFailure("cancelled");

  const candidate = (await getTeamEntryCandidates(gate.team.id)).find(
    (member) => member.userId === userId,
  );
  if (!candidate) return teamFailure("notfound");

  const members = await getEntryMembers(entryId);
  if (members.some((member) => member.userId === userId)) return teamFailure("already_member");

  const eventDate = parseDateOnly(event.date);
  if (!candidate.dateOfBirth || !meetsMinParticipantAge(candidate.dateOfBirth, eventDate)) {
    return { ...teamFailure("member_underage"), memberName: candidate.displayName };
  }
  if ((await findIndividuallyRegistered(gate.entry.eventSlug, [userId])).has(userId)) {
    return { ...teamFailure("registered_individually"), memberName: candidate.displayName };
  }

  const added = await addMemberRows({
    entryId,
    eventSlug: gate.entry.eventSlug,
    seat: { userId, locale: candidate.locale },
  });
  if (!added.ok) return added;

  const seat = (await getEntryMembers(entryId)).find((member) => member.userId === userId);
  if (seat) {
    await sendConfirmRequestEmail({
      variant: "added",
      member: seat,
      team: gate.team,
      event: toMailEvent(event),
    });
  }

  revalidateEntrySurfaces();
  return { ok: true };
}

/**
 * Remove an entered member who dropped out (user story 11).
 *
 * Deletes their registration with the seat — see `removeMemberRows` for why
 * leaving the registration behind would be worse than removing it. No email:
 * the two mails this PRD defines are the confirmation request and the
 * withdrawal, and a runner who told their manager they are out does not need to
 * be told back. (Say so here rather than leave it looking like an omission.)
 */
export async function removeEntryMember(
  entryId: string,
  userId: string,
): Promise<EntryActionResult> {
  const gate = await gateEntry(entryId);
  if (!gate.ok) return gate;
  if (!userId || typeof userId !== "string") return teamFailure("invalid");
  if (gate.entry.status !== "entered") return teamFailure("already_checked_in");

  const removed = await removeMemberRows(entryId, userId);
  if (!removed.ok) return removed;

  revalidateEntrySurfaces();
  return { ok: true };
}

/**
 * Withdraw the whole entry (user stories 12 and 35).
 *
 * The order is load-bearing and is the brief's Decision 6: collect the
 * recipients and their registration ids → mail every member → write the log
 * rows → delete the entry and the registrations in one transaction. Mailing
 * *after* the delete is impossible (there would be no addresses and no event to
 * name), and deleting first would leave a member who never heard about it
 * turning up on the night.
 *
 * The `team_entry_withdrawn` log rows are deleted moments later with the
 * registrations they reference — see the note on `sendEntryWithdrawnEmail`.
 */
export async function withdrawEntry(entryId: string): Promise<EntryActionResult> {
  const gate = await gateEntry(entryId);
  if (!gate.ok) return gate;
  if (gate.entry.status !== "entered") return teamFailure("already_checked_in");

  const members = await getEntryMembers(entryId);
  // The event may have been deleted or hidden since the entry was made; the
  // withdrawal must still go through, so the mail is best-effort on the facts
  // we can still name.
  const event = await getEventBySlug(gate.entry.eventSlug);

  if (event) {
    for (const member of members) {
      await sendEntryWithdrawnEmail({
        member,
        team: gate.team,
        event: toMailEvent(event),
      });
    }
  } else {
    console.warn(
      `[teams] withdrawing entry ${entryId} for unknown event ${gate.entry.eventSlug} — no mail sent`,
    );
  }

  const withdrawn = await withdrawEntryRows(
    entryId,
    members.map((member) => member.registrationId),
  );
  if (!withdrawn.ok) return withdrawn;

  console.info(
    `[teams] entry ${entryId} withdrawn from ${gate.entry.eventSlug}: ${members.length} registration(s) deleted`,
  );

  revalidateEntrySurfaces();
  return { ok: true };
}

/**
 * Resend one member's confirmation link, at most once per 24 hours
 * (user stories 8 and 9).
 *
 * The clock is the `event_email_log` row's `sentAt` — the same row that makes
 * the mail idempotent — so there is no separate "last reminded" column that
 * could disagree with what was actually sent. A *failed* attempt counts, on
 * purpose: otherwise a broken mailbox would let a manager retry in a loop.
 *
 * Refuses `already_confirmed` for a member who has already ticked, because the
 * link they would be sent leads to a screen with nothing left to do.
 */
export async function remindMember(
  entryId: string,
  userId: string,
): Promise<EntryActionResult> {
  const gate = await gateEntry(entryId);
  if (!gate.ok) return gate;
  if (!userId || typeof userId !== "string") return teamFailure("invalid");

  const event = await loadTeamEvent(gate.entry.eventSlug);
  if (!event) return teamFailure("notfound");
  if (event.status === "cancelled") return teamFailure("cancelled");

  const member = (await getEntryMembers(entryId)).find((seat) => seat.userId === userId);
  if (!member) return teamFailure("notfound");
  if (member.confirmed) return teamFailure("already_confirmed");

  const lastSent = await lastConfirmRequestAt(member.registrationId);
  if (lastSent && Date.now() - lastSent.getTime() < REMIND_INTERVAL_MS) {
    return teamFailure("remind_limit");
  }

  await sendConfirmRequestEmail({
    variant: "reminder",
    member,
    team: gate.team,
    event: toMailEvent(event),
  });

  return { ok: true };
}
