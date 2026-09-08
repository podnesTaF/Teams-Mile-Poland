import { and, asc, eq, inArray, isNull, isNotNull, sql } from "drizzle-orm";

import { eventHeats } from "@/db/schema/event-heats";
import { eventRegistrations } from "@/db/schema/event-registrations";
import { teamEntries, teamEntryMembers } from "@/db/schema/team-entries";
import { LEASE_ATTEMPTS, leaseBib, pickFreeBibs } from "@/features/admin/bib-lease";
import { getHeldBib } from "@/features/admin/events-data";
import { DEFAULT_HEAT_TEAM_CAPACITY } from "@/features/admin/heats-data";
import { executor, getDb, type DbExecutor } from "@/lib/db";

import { teamFailure, type TeamActionResult } from "./config";
import type { EntryMemberView } from "./entries";
import type { CompositionRow } from "./rating-rules";

/**
 * Team check-in — the transaction behind `checkInTeam` and `swapComposed`
 * (PRD #64, slice #69).
 *
 * The split is `entries.ts`'s: **everything here is already past the gate and
 * past the validator**. `actions/checkin.ts` holds the `checkin` capability
 * check, reads the roster through `getEntryMembers`, runs
 * `validateComposition` and maps its problem onto a refusal; by the time these
 * functions run, the composition is legal and the only remaining questions are
 * inventory and concurrency.
 *
 * ## Why one transaction, and why it may have to be re-run
 *
 * A team leaves the desk with seven decisions written at once: a race role per
 * composed member, a reserve flag on the rest, a bib lease per composed member,
 * the entry's status, and a heat for the whole team. Half of that is worse than
 * none — a team with three bibs and no roles cannot be raced, and the desk has
 * no way to tell which half landed. So it is one `db.transaction`.
 *
 * That has one consequence which shapes the whole loop: **in Postgres a unique
 * violation aborts the transaction**, so the individual desk's "suggest a
 * number, retry on a clash" cannot work here — the retry would run against a
 * dead transaction. The bib pool's `unique (event_slug, bib) where bib is not
 * null and bib_returned_at is null` (ADR 0003) is exactly such an index. The
 * procedure is therefore the one `bib-lease.ts` documents:
 *
 *   1. {@link pickFreeBibs} inside the transaction — N numbers, distinct from
 *      each other and from leases this transaction has already written;
 *   2. `leaseBib(..., { bib, tx })` per composed member, **pairs before
 *      RACERS** so the joker zone always has chips to read (user story 31);
 *   3. on `bib_held` — another desk took one of them between the pick and the
 *      write — throw {@link BibRaceError}, roll the whole thing back and start
 *      again, at most {@link LEASE_ATTEMPTS} times.
 *
 * A **short pool is not a race and is never retried**: the members past the end
 * of the free list are checked in bib-pending (ADR 0003 — a runner at the desk
 * is never blocked by inventory) and named in the result so the desk can say so
 * out loud.
 */

/** A heat a whole team can be seeded into. */
export type HeatSeat = { id: string; number: number };

/**
 * The earliest published, unstarted, unfinished heat of a team event that still
 * has room for one more **team**.
 *
 * The team twin of `findHeatWithRoom`, and different from it in the two ways
 * that matter: the occupancy counted is `team_entries.heat_id` (a team is one
 * unit on the card — user story 34, "a team is never split across heats") and
 * the bound is `capacity_teams`, defaulting to
 * {@link DEFAULT_HEAT_TEAM_CAPACITY} for a heat generated before the column
 * existed.
 *
 * `started_at is null` is stricter than the individual walk-up seeding, on
 * purpose: a team seeded into a heat that has already been sent off cannot
 * race it, and #69 introduced the timestamp precisely so "has it gone yet" is
 * answerable.
 *
 * Earliest rather than emptiest, like the individual path: a team that has just
 * finished checking in should run at the next opportunity.
 */
export async function findHeatWithRoomForTeam(
  eventSlug: string,
  tx?: DbExecutor,
): Promise<HeatSeat | null> {
  const db = executor(tx);
  const [row] = await db
    .select({ id: eventHeats.id, number: eventHeats.number })
    .from(eventHeats)
    .leftJoin(teamEntries, eq(teamEntries.heatId, eventHeats.id))
    .where(
      and(
        eq(eventHeats.eventSlug, eventSlug),
        isNotNull(eventHeats.publishedAt),
        isNull(eventHeats.startedAt),
        isNull(eventHeats.finishedAt),
      ),
    )
    .groupBy(eventHeats.id)
    .having(
      sql`count(${teamEntries.id}) < coalesce(${eventHeats.capacityTeams}, ${DEFAULT_HEAT_TEAM_CAPACITY})`,
    )
    .orderBy(asc(eventHeats.scheduledAt), asc(eventHeats.number))
    .limit(1);
  return row ?? null;
}

/** What one composed member ended up wearing. `null` is bib-pending. */
export type TeamCheckInLease = { userId: string; bib: number | null };

/** Everything the desk is told about a check-in that succeeded. */
export type TeamCheckInWritten = {
  /** Composed members checked in with no bib — the pool ran out. */
  pending: string[];
  /** Every composed member's lease, pairs first (the order they were served). */
  leases: TeamCheckInLease[];
  heatId: string | null;
  /** The heat number, or `null` when no published heat had room for a team. */
  heatNumber: number | null;
};

/** Thrown inside the transaction when a picked bib was taken meanwhile. */
class BibRaceError extends Error {
  constructor() {
    super("bib_held");
    this.name = "BibRaceError";
  }
}

/**
 * Composed members in the order they are served bibs: **pair members first**
 * (by pair number, ACE before JOKER), then RACERS in roster order.
 *
 * Story 31 is the whole reason this ordering exists — with a short pool the
 * zone timing must still have chips, so a pair never loses a number to a
 * RACER. ACE before JOKER inside a pair is not required by anything; it is
 * chosen so the served order is deterministic and a verification script can
 * assert exactly which numbers landed where.
 */
function leaseOrder(composition: CompositionRow[]): CompositionRow[] {
  const rank = (row: CompositionRow) => (row.role === "racer" ? 1 : 0);
  return [...composition].sort((a, b) => {
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    if (rank(a) === 1) return 0;
    if ((a.pairNo ?? 0) !== (b.pairNo ?? 0)) return (a.pairNo ?? 0) - (b.pairNo ?? 0);
    return a.role === "ace" ? -1 : 1;
  });
}

/**
 * Write a validated composition and check the team in — roles, reserves, bib
 * leases, entry status and heat seating, in one transaction, retried whole when
 * a concurrent desk takes one of the picked numbers.
 *
 * `members` is the entry's roster as `getEntryMembers` returns it, so the
 * registration ids the leases are written against are the same rows the
 * checklist and the validator read. `composition` has already been through
 * `validateComposition`; nothing here re-judges it.
 */
export async function checkInTeamRows({
  entryId,
  eventSlug,
  members,
  composition,
}: {
  entryId: string;
  eventSlug: string;
  members: EntryMemberView[];
  composition: CompositionRow[];
}): Promise<TeamActionResult<TeamCheckInWritten>> {
  const bySeat = new Map(members.map((member) => [member.userId, member]));
  const composed = leaseOrder(composition);
  const composedIds = new Set(composed.map((row) => row.userId));
  const reserves = members.filter((member) => !composedIds.has(member.userId));
  const db = getDb();

  for (let attempt = 0; attempt < LEASE_ATTEMPTS; attempt += 1) {
    try {
      return await db.transaction(async (tx) => {
        // Picked inside the transaction so the numbers are distinct from each
        // other *and* from leases written moments ago by this same block.
        const free = await pickFreeBibs(eventSlug, composed.length, tx);
        let cursor = 0;
        const leases: TeamCheckInLease[] = [];
        const pending: string[] = [];

        for (const row of composed) {
          // Non-null: the action resolved every composed id against the roster.
          const seat = bySeat.get(row.userId) as EntryMemberView;

          // A bib pre-assigned in the heat builder is already this runner's
          // lease — confirm it rather than stack a second number on top, and
          // leave the free list for somebody who has none. `pickFreeBibs`
          // excludes held numbers, so the two can never collide.
          const held = await getHeldBib(seat.registrationId, tx);
          let bib: number | null = held;
          if (held === null && cursor < free.length) {
            bib = free[cursor];
            cursor += 1;
          }

          const lease = await leaseBib(eventSlug, seat.registrationId, { bib, tx });
          if (lease.ok === "bib_held") throw new BibRaceError();
          if (lease.ok === "race" || lease.ok === "bib_invalid") {
            // Neither is reachable with the explicit-number procedure above —
            // `race` needs the retry loop `leaseBib` only runs without a bib,
            // and every number came out of the event's own slot list. Treated
            // as a race rather than swallowed, so an unexpected one rolls back.
            throw new BibRaceError();
          }
          if (lease.ok === "pending") {
            pending.push(row.userId);
            leases.push({ userId: row.userId, bib: null });
          } else {
            leases.push({ userId: row.userId, bib: lease.bib });
          }
        }

        // Roles, pairs and stage options on the composed seats.
        for (const row of composed) {
          await tx
            .update(teamEntryMembers)
            .set({
              raceRole: row.role,
              pairNo: row.pairNo ?? null,
              stageOption: row.stageOption ?? null,
              isReserve: false,
            })
            .where(
              and(eq(teamEntryMembers.entryId, entryId), eq(teamEntryMembers.userId, row.userId)),
            );
        }

        // Everyone else is a Reserve, with the race fields cleared: a swap
        // moves a role onto a seat, so a stale role left on a reserve would be
        // a second claim on the same pair (user story 32).
        if (reserves.length > 0) {
          await tx
            .update(teamEntryMembers)
            .set({ raceRole: null, pairNo: null, stageOption: null, isReserve: true })
            .where(
              and(
                eq(teamEntryMembers.entryId, entryId),
                inArray(
                  teamEntryMembers.userId,
                  reserves.map((member) => member.userId),
                ),
              ),
            );
        }

        const heat = await findHeatWithRoomForTeam(eventSlug, tx);

        await tx
          .update(teamEntries)
          .set({ status: "checked_in", checkedInAt: new Date(), heatId: heat?.id ?? null })
          .where(eq(teamEntries.id, entryId));

        // The team's heat is also each composed runner's heat: the card, the
        // heat-card export and the start list all read `event_registrations.heat_id`.
        if (heat) {
          await tx
            .update(eventRegistrations)
            .set({ heatId: heat.id })
            .where(
              inArray(
                eventRegistrations.id,
                composed.map((row) => (bySeat.get(row.userId) as EntryMemberView).registrationId),
              ),
            );
        }

        return {
          ok: true as const,
          pending,
          leases,
          heatId: heat?.id ?? null,
          heatNumber: heat?.number ?? null,
        };
      });
    } catch (error) {
      if (error instanceof BibRaceError) continue;
      throw error;
    }
  }

  // Every attempt lost the same race. Reported as `bib_pool` — the reason set
  // is frozen (`config.ts`) and this is the one about numbers; nothing was
  // written, so pressing again is safe.
  return teamFailure("bib_pool");
}

/** What a swap moved. */
export type SwapWritten = {
  /** The bib that changed shoulders, or `null` when the outgoing had none. */
  bib: number | null;
  /** The role the reserve inherited. */
  role: NonNullable<EntryMemberView["raceRole"]>;
};

/**
 * Swap an absent composed member for a Reserve: the role, the pair, the stage
 * option, the bib lease and the heat all move to the runner coming in
 * (user story 33).
 *
 * One transaction, in a load-bearing order: **the outgoing lease is returned
 * before the incoming one is written**, because the pool's partial unique index
 * would otherwise see the same number held twice inside the statement that
 * writes it (ADR 0003). No number is picked here — this is the same bib, on a
 * different runner.
 *
 * The outgoing member's registration goes back to `registered` with its bib
 * returned, which is exactly what `setRegistrationStatus` does on the
 * individual desk. That helper is not transaction-aware, and a swap must be
 * atomic, so its UPDATE is restated here — the `coalesce` on `bib_returned_at`
 * included, so a bib returned earlier keeps its original return time.
 */
export async function swapComposedRows({
  entryId,
  eventSlug,
  outgoing,
  incoming,
  heatId,
}: {
  entryId: string;
  /** The entry's event — what the lease is written against. */
  eventSlug: string;
  /** The composed member leaving the composition, as the roster reads them. */
  outgoing: EntryMemberView;
  /** The reserve coming in. */
  incoming: EntryMemberView;
  /** The entry's heat, moved onto the incoming registration. */
  heatId: string | null;
}): Promise<TeamActionResult<SwapWritten>> {
  const role = outgoing.raceRole;
  if (!role) return teamFailure("invalid");

  const db = getDb();
  return db.transaction(async (tx) => {
    // 1. The role, the pair and the handover point move.
    await tx
      .update(teamEntryMembers)
      .set({
        raceRole: role,
        pairNo: outgoing.pairNo,
        stageOption: outgoing.stageOption,
        isReserve: false,
      })
      .where(
        and(eq(teamEntryMembers.entryId, entryId), eq(teamEntryMembers.userId, incoming.userId)),
      );
    await tx
      .update(teamEntryMembers)
      .set({ raceRole: null, pairNo: null, stageOption: null, isReserve: true })
      .where(
        and(eq(teamEntryMembers.entryId, entryId), eq(teamEntryMembers.userId, outgoing.userId)),
      );

    // 2. The outgoing runner hands the number back and leaves the card.
    await tx
      .update(eventRegistrations)
      .set({
        status: "registered",
        checkedInAt: null,
        heatId: null,
        bibReturnedAt: sql`case when ${eventRegistrations.bib} is null then null
          else coalesce(${eventRegistrations.bibReturnedAt}, now()) end`,
      })
      .where(eq(eventRegistrations.id, outgoing.registrationId));

    // 3. …and the reserve wears it. `leaseBib` with an explicit number is the
    //    same call the individual desk makes, so the ACER accrual and the
    //    `checked_in` transition are written in exactly one place.
    const lease = await leaseBib(eventSlug, incoming.registrationId, {
      bib: outgoing.bib,
      tx,
    });
    if (lease.ok === "bib_held") return teamFailure("bib_pool");

    await tx
      .update(eventRegistrations)
      .set({ heatId })
      .where(eq(eventRegistrations.id, incoming.registrationId));

    return { ok: true as const, bib: lease.ok === "bib" ? lease.bib : null, role };
  });
}
