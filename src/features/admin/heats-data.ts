import { and, asc, eq, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";

import {
  eventHeats,
  eventRegistrations,
  heatState,
  teamEntries,
  users,
  type HeatState,
  type ParticipationStatus,
} from "@/db/schema";
import { COMPOSITION } from "@/features/teams/rating-rules";
import { getDb } from "@/lib/db";

/**
 * How many **teams** a team-event heat holds when nothing says otherwise
 * (PRD #64, "Heats hold whole teams" — default 7, bounded by the bib pool).
 *
 * A default rather than a backfill: heats generated before `capacity_teams`
 * existed carry `null`, and a null there has to mean "the contract's seven"
 * everywhere it is read, or the seeding query and the builder's fill meter
 * would disagree about whether a heat is full.
 */
export const DEFAULT_HEAT_TEAM_CAPACITY = 7;

/**
 * The largest composition any category names (mixed: 4 RACERS + 2 pairs = 8).
 *
 * A team event hosts all three categories on one night, so a heat's runner
 * bound cannot be computed from *a* category — only from the worst case. Used
 * to translate a teams-per-heat figure into the runner capacity the column
 * still stores, and to bound it by the bib pool (ADR 0003: a heat the timing
 * system cannot chip is not a heat).
 */
export const MAX_COMPOSED_SEATS = Math.max(
  ...Object.values(COMPOSITION).map((rules) => rules.racers + rules.pairs * 2),
);

/** A heat plus how full it is — the unit the builder renders. */
export type HeatWithFill = {
  id: string;
  number: number;
  capacity: number;
  /** The `capacity_teams` column verbatim — `null` on an individual heat, and on a team heat generated before the column existed. */
  capacityTeams: number | null;
  /**
   * The effective teams-per-heat bound: `capacityTeams` or
   * {@link DEFAULT_HEAT_TEAM_CAPACITY}.
   *
   * Resolved here rather than at each reader because the heat builder is a
   * **client** component: importing the constant into it would drag
   * `heats-data` — and with it the Postgres driver — into the browser bundle.
   * One definition of the default, in the module that owns heats.
   */
  teamCapacity: number;
  scheduledAt: Date;
  publishedAt: Date | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  state: HeatState;
  /** Registrations currently seeded into this heat. */
  fill: number;
  /** Team entries seeded into this heat — 0 on every individual heat. */
  teams: number;
  /** Bib leases its members are still holding — what finishing it would free. */
  bibsHeld: number;
};

/** The teams-per-heat bound a bib pool can actually chip, never below 1. */
export function maxTeamsPerHeat(bibPool: number): number {
  return Math.max(1, Math.floor(bibPool / MAX_COMPOSED_SEATS));
}

/** What a runner has last been told about the heat they are currently in. */
export type HeatNotifyState = "none" | "stale" | "notified";

/**
 * The publish delta, in one place: where a runner is now versus what they were
 * last emailed (`notifiedHeatId` / `notifiedHeatTime`).
 *
 * - `"none"` — never notified, or not in a heat at all. Covers a walk-up seeded
 *   after the card was first published.
 * - `"stale"` — notified, but their heat or start time has moved since.
 * - `"notified"` — what they hold in their inbox is current.
 *
 * `publishHeats` mails everything that is not `"notified"`; the builder counts
 * the same set so the button can say how many it will email. Times compare by
 * instant, not identity — the driver hands back fresh `Date` objects.
 */
export function heatNotifyState(r: {
  heatId: string | null;
  scheduledAt: Date | null;
  notifiedHeatId: string | null;
  notifiedHeatTime: Date | null;
}): HeatNotifyState {
  if (!r.heatId || !r.scheduledAt) return "none";
  if (r.notifiedHeatId === null) return "none";
  if (r.notifiedHeatId !== r.heatId) return "stale";
  return r.notifiedHeatTime?.getTime() === r.scheduledAt.getTime() ? "notified" : "stale";
}

/** One seedable runner: a row of the builder's runner lists. */
export type SeedRow = {
  id: string;
  heatId: string | null;
  status: ParticipationStatus;
  name: string;
  email: string;
  club: string | null;
  sex: "M" | "F" | null;
  /** The bib they are currently holding — pre-assigned or leased at check-in. */
  bib: number | null;
  /** Whether a publish press would email this runner (see {@link heatNotifyState}). */
  notifyState: HeatNotifyState;
};

/**
 * Heats for an event, lowest number first, each with its fill count and how many
 * bib leases its members still hold.
 *
 * Fill counts every seeded registration regardless of status: a runner occupies a
 * lane on the card whether or not they have checked in yet. `bibsHeld` counts only
 * live leases, so the race-morning desk can see what marking the heat finished
 * would actually return to the pool.
 *
 * `teams` is the same fill counted in **team entries** (PRD #64) and comes from
 * a second grouped query rather than a second `LEFT JOIN`: joining both
 * `event_registrations` and `team_entries` onto the heat multiplies the rows,
 * and every count above would silently inflate. Zero on every individual heat,
 * where no team entry references it.
 */
export async function getEventHeats(eventSlug: string): Promise<HeatWithFill[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: eventHeats.id,
      number: eventHeats.number,
      capacity: eventHeats.capacity,
      capacityTeams: eventHeats.capacityTeams,
      scheduledAt: eventHeats.scheduledAt,
      publishedAt: eventHeats.publishedAt,
      startedAt: eventHeats.startedAt,
      finishedAt: eventHeats.finishedAt,
      fill: sql<number>`count(${eventRegistrations.id})::int`,
      bibsHeld: sql<number>`(count(${eventRegistrations.bib}) filter (
        where ${eventRegistrations.bibReturnedAt} is null))::int`,
    })
    .from(eventHeats)
    .leftJoin(eventRegistrations, eq(eventRegistrations.heatId, eventHeats.id))
    .where(eq(eventHeats.eventSlug, eventSlug))
    .groupBy(eventHeats.id)
    .orderBy(asc(eventHeats.number));

  const teamRows = await db
    .select({ heatId: teamEntries.heatId, teams: sql<number>`count(*)::int` })
    .from(teamEntries)
    .where(and(eq(teamEntries.eventSlug, eventSlug), isNotNull(teamEntries.heatId)))
    .groupBy(teamEntries.heatId);
  const teamsByHeat = new Map(teamRows.map((r) => [r.heatId as string, r.teams]));

  return rows.map((r) => ({
    ...r,
    teams: teamsByHeat.get(r.id) ?? 0,
    teamCapacity: r.capacityTeams ?? DEFAULT_HEAT_TEAM_CAPACITY,
    state: heatState(r),
  }));
}

/**
 * The seeding pool for an event: everyone who confirmed they are coming, plus
 * anyone already placed in a heat whatever their status — a runner who has since
 * checked in must not vanish off the card mid-morning, and a mistakenly seeded
 * no-show has to stay visible to be taken off.
 *
 * Ordered by surname so the lists read alphabetically.
 */
export async function getSeedPool(eventSlug: string): Promise<SeedRow[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: eventRegistrations.id,
      heatId: eventRegistrations.heatId,
      status: eventRegistrations.status,
      firstName: users.firstName,
      lastName: users.lastName,
      fallbackName: users.name,
      email: users.email,
      club: users.club,
      sex: users.sex,
      bib: eventRegistrations.bib,
      bibReturnedAt: eventRegistrations.bibReturnedAt,
      notifiedHeatId: eventRegistrations.notifiedHeatId,
      notifiedHeatTime: eventRegistrations.notifiedHeatTime,
      scheduledAt: eventHeats.scheduledAt,
    })
    .from(eventRegistrations)
    .innerJoin(users, eq(eventRegistrations.userId, users.id))
    // Left, not inner: unseeded runners are the Unassigned list.
    .leftJoin(eventHeats, eq(eventRegistrations.heatId, eventHeats.id))
    .where(
      and(
        eq(eventRegistrations.eventSlug, eventSlug),
        or(
          eq(eventRegistrations.status, "confirmed"),
          eq(eventRegistrations.status, "checked_in"),
          isNotNull(eventRegistrations.heatId),
        ),
      ),
    )
    .orderBy(asc(users.lastName), asc(users.firstName));

  return rows.map((r) => ({
    id: r.id,
    heatId: r.heatId,
    // `cancelled` is deprecated and never set — narrow to the live union.
    status: r.status as ParticipationStatus,
    name: [r.firstName, r.lastName].filter(Boolean).join(" ") || r.fallbackName,
    email: r.email,
    club: r.club,
    sex: r.sex,
    // A returned bib is history, not a lease — the builder shows held numbers only.
    bib: r.bibReturnedAt === null ? r.bib : null,
    notifyState: heatNotifyState(r),
  }));
}

/**
 * Heat numbers whose start time is not strictly after the previous heat's. The
 * builder warns on these rather than blocking: an admin may genuinely want two
 * heats on the same gun, and a typo caught by a warning beats an edit refused.
 */
export function outOfOrderHeats(heats: HeatWithFill[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < heats.length; i += 1) {
    if (heats[i].scheduledAt.getTime() <= heats[i - 1].scheduledAt.getTime()) {
      out.push(heats[i].number);
    }
  }
  return out;
}

/* ── mutations ──────────────────────────────────────────────────────── */

/**
 * Most heats one generate press may create. A fat-finger guard rather than a
 * rule about racing — nine heats of twelve already fills the 90-minute window.
 */
export const MAX_GENERATE_HEATS = 40;

/** The highest heat number an event has, or 0 when it has none. */
async function maxHeatNumber(eventSlug: string): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ max: sql<number>`coalesce(max(${eventHeats.number}), 0)::int` })
    .from(eventHeats)
    .where(eq(eventHeats.eventSlug, eventSlug));
  return row?.max ?? 0;
}

/**
 * Create `count` heats, numbered on from the event's highest existing heat, with
 * `scheduledAt` spaced `intervalMinutes` apart from `firstStart`.
 *
 * Generating appends rather than replacing — the unique `(event_slug, number)`
 * index makes restarting at 1 a conflict, and a heat number is something runners
 * are emailed, so numbers are never reused or shuffled.
 *
 * `capacity` is expected to be within the event's bib pool; the caller validates
 * it so the admin sees why a value was refused (ADR 0003).
 *
 * `capacityTeams` is set on team events only (PRD #64). `capacity` is still
 * written there — the column is `not null`, and the runner figure remains the
 * honest bound on how many people the heat can chip — so the caller derives it
 * from the teams figure ({@link MAX_COMPOSED_SEATS}).
 */
export async function createHeats(
  eventSlug: string,
  opts: {
    count: number;
    capacity: number;
    capacityTeams?: number;
    firstStart: Date;
    intervalMinutes: number;
  },
): Promise<number> {
  const db = getDb();
  const from = await maxHeatNumber(eventSlug);
  const values = Array.from({ length: opts.count }, (_, i) => ({
    eventSlug,
    number: from + i + 1,
    capacity: opts.capacity,
    ...(opts.capacityTeams !== undefined ? { capacityTeams: opts.capacityTeams } : {}),
    scheduledAt: new Date(opts.firstStart.getTime() + i * opts.intervalMinutes * 60_000),
  }));

  const created = await db.insert(eventHeats).values(values).returning({ id: eventHeats.id });
  return created.length;
}

/**
 * Patch a heat's capacity and/or start time. Scoped by slug so a heat id from
 * another event cannot be edited through this event's page.
 *
 * `"nothing-to-do"` (an empty patch) is distinguished from `"missing"` (no such
 * heat) so the builder does not tell the admin a heat has vanished when they
 * simply pressed Save on an untouched form.
 */
export async function updateHeatRow(
  eventSlug: string,
  heatId: string,
  patch: { capacity?: number; capacityTeams?: number; scheduledAt?: Date },
): Promise<"updated" | "missing" | "nothing-to-do"> {
  if (
    patch.capacity === undefined &&
    patch.capacityTeams === undefined &&
    patch.scheduledAt === undefined
  ) {
    return "nothing-to-do";
  }
  const db = getDb();
  const rows = await db
    .update(eventHeats)
    .set(patch)
    .where(and(eq(eventHeats.id, heatId), eq(eventHeats.eventSlug, eventSlug)))
    .returning({ id: eventHeats.id });
  return rows.length > 0 ? "updated" : "missing";
}

/**
 * Delete a heat. Its members become unassigned — the `heat_id` FK is
 * `on delete set null`, so the registrations themselves are untouched and simply
 * fall back into the Unassigned list.
 *
 * Remaining heats keep their numbers: renumbering would move a heat number that
 * has already been emailed.
 */
export async function deleteHeatRow(eventSlug: string, heatId: string): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .delete(eventHeats)
    .where(and(eq(eventHeats.id, heatId), eq(eventHeats.eventSlug, eventSlug)))
    .returning({ id: eventHeats.id });
  return rows.length > 0;
}

/**
 * Release the event's card: stamp `publishedAt` on its still-unpublished heats.
 * Returns how many were newly published.
 *
 * Only null timestamps are written. `publishedAt` records when the card was
 * *first* released, and publishing is re-pressable after edits (PRD #26) — a
 * second press must not rewrite that instant, or the audit trail of when runners
 * were first told would move every time an admin fixed a typo. Per-event by
 * design: no runner should see a half-released card.
 */
export async function publishEventHeats(eventSlug: string): Promise<number> {
  const db = getDb();
  const rows = await db
    .update(eventHeats)
    .set({ publishedAt: new Date() })
    .where(and(eq(eventHeats.eventSlug, eventSlug), isNull(eventHeats.publishedAt)))
    .returning({ id: eventHeats.id });
  return rows.length;
}

/** Whether a heat id belongs to this event. */
export async function heatBelongsToEvent(eventSlug: string, heatId: string): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .select({ id: eventHeats.id })
    .from(eventHeats)
    .where(and(eq(eventHeats.id, heatId), eq(eventHeats.eventSlug, eventSlug)))
    .limit(1);
  return Boolean(row);
}

/* ── race morning ───────────────────────────────────────────────────── */

/**
 * The heat a walk-up should join: the earliest published, unfinished heat with a
 * free lane. Earliest rather than emptiest, because someone who has just arrived
 * and been chipped should run at the next opportunity.
 *
 * Individual heats only — `capacity_teams` is null. On a mixed night (ADR 0009)
 * a heat with a teams figure is a team heat, raced with the mace and seated by
 * the team desk, and a solo runner must not be dropped into it. Harmless on an
 * individual night, where no heat carries the column.
 */
export async function findHeatWithRoom(
  eventSlug: string,
): Promise<{ id: string; number: number } | null> {
  const db = getDb();
  const [row] = await db
    .select({ id: eventHeats.id, number: eventHeats.number })
    .from(eventHeats)
    .leftJoin(eventRegistrations, eq(eventRegistrations.heatId, eventHeats.id))
    .where(
      and(
        eq(eventHeats.eventSlug, eventSlug),
        isNull(eventHeats.capacityTeams),
        isNotNull(eventHeats.publishedAt),
        isNull(eventHeats.finishedAt),
      ),
    )
    .groupBy(eventHeats.id)
    .having(sql`count(${eventRegistrations.id}) < ${eventHeats.capacity}`)
    .orderBy(asc(eventHeats.scheduledAt), asc(eventHeats.number))
    .limit(1);
  return row ?? null;
}

export type WalkUpPlacement =
  | { placed: true; heatNumber: number }
  /** Already on the card, or no published heat has a free lane (**Unplaced**). */
  | { placed: false; reason: "already-seeded" | "no-room" };

/**
 * Seed a walk-up into a published heat with room.
 *
 * `"no-room"` is the **Unplaced** case, not a failure: being chipped never depends
 * on heat insertion succeeding (PRD #26), so the runner stays checked in and
 * surfaces on the desk's Unplaced list for deliberate placement.
 *
 * The update is guarded on `heat_id is null` as well as the pre-read, so a runner
 * an admin deliberately seeded is never dragged out of their heat.
 */
export async function placeWalkUp(
  eventSlug: string,
  registrationId: string,
): Promise<WalkUpPlacement> {
  const db = getDb();
  const [registration] = await db
    .select({ heatId: eventRegistrations.heatId })
    .from(eventRegistrations)
    .where(
      and(
        eq(eventRegistrations.id, registrationId),
        eq(eventRegistrations.eventSlug, eventSlug),
      ),
    )
    .limit(1);
  if (!registration || registration.heatId) return { placed: false, reason: "already-seeded" };

  const heat = await findHeatWithRoom(eventSlug);
  if (!heat) return { placed: false, reason: "no-room" };

  const rows = await db
    .update(eventRegistrations)
    .set({ heatId: heat.id })
    .where(
      and(
        eq(eventRegistrations.id, registrationId),
        eq(eventRegistrations.eventSlug, eventSlug),
        isNull(eventRegistrations.heatId),
      ),
    )
    .returning({ id: eventRegistrations.id });
  return rows.length > 0
    ? { placed: true, heatNumber: heat.number }
    : { placed: false, reason: "already-seeded" };
}

/**
 * When a heat was sent off and when it came back — the two facts a swap is
 * judged against (PRD #64: `swapComposed` refuses `heat_started`).
 *
 * A separate narrow read rather than a use of `getEventHeats`: the swap needs
 * one heat's timestamps and nothing else, and it is called from a server action
 * that has an entry id, not an event slug.
 */
export async function getHeatRunState(
  heatId: string,
): Promise<{ eventSlug: string; number: number; startedAt: Date | null; finishedAt: Date | null } | null> {
  const db = getDb();
  const [row] = await db
    .select({
      eventSlug: eventHeats.eventSlug,
      number: eventHeats.number,
      startedAt: eventHeats.startedAt,
      finishedAt: eventHeats.finishedAt,
    })
    .from(eventHeats)
    .where(eq(eventHeats.id, heatId))
    .limit(1);
  return row ?? null;
}

export type StartOutcome =
  | { result: "started"; number: number }
  | { result: "already" }
  | { result: "not-published" }
  | { result: "missing" };

/**
 * Stamp a heat as started — the swap deadline (PRD #64, brief Decision 1).
 *
 * Only a null timestamp is written, for the same reason `publishEventHeats`
 * only writes null `publishedAt`: this records when the gun actually went, and
 * a second press must not move it. A draft heat cannot start — nobody was told
 * to run it — which keeps the card's order draft → published → started →
 * finished rather than letting a heat skip its release.
 *
 * Deliberately **not** part of `heatState()`: a started heat is still a
 * published one as far as the public start list is concerned.
 */
export async function markHeatStartedRow(heatId: string): Promise<StartOutcome> {
  const db = getDb();
  const state = await getHeatRunState(heatId);
  if (!state) return { result: "missing" };
  if (state.startedAt || state.finishedAt) return { result: "already" };

  const rows = await db
    .update(eventHeats)
    .set({ startedAt: new Date() })
    .where(and(eq(eventHeats.id, heatId), isNull(eventHeats.startedAt), isNotNull(eventHeats.publishedAt)))
    .returning({ number: eventHeats.number });
  if (rows.length === 0) return { result: "not-published" };
  return { result: "started", number: rows[0].number };
}

export type FinishOutcome =
  | { result: "finished"; returned: number }
  | { result: "already" }
  | { result: "not-published" }
  | { result: "missing" };

/**
 * Mark a heat finished and return every bib its members still hold to the pool —
 * one action, because reclaiming a dozen numbers one at a time is not something a
 * marshal will do between heats (PRD #26).
 *
 * A draft heat cannot be finished: nobody was ever told to run it, so it has not
 * happened. This keeps `heatState`'s three states in the order the card actually
 * moves through them — draft → published → finished — rather than letting a heat
 * skip straight from unreleased to run.
 *
 * Atomic: the stamp and the returns land together, so the pool can never read as
 * freed by a heat that is not finished, or vice versa.
 */
export async function finishHeatRow(
  eventSlug: string,
  heatId: string,
): Promise<FinishOutcome> {
  const db = getDb();
  return db.transaction(async (tx) => {
    const [heat] = await tx
      .select({ publishedAt: eventHeats.publishedAt, finishedAt: eventHeats.finishedAt })
      .from(eventHeats)
      .where(and(eq(eventHeats.id, heatId), eq(eventHeats.eventSlug, eventSlug)))
      .limit(1);
    if (!heat) return { result: "missing" };
    if (heat.finishedAt) return { result: "already" };
    if (!heat.publishedAt) return { result: "not-published" };

    await tx.update(eventHeats).set({ finishedAt: new Date() }).where(eq(eventHeats.id, heatId));

    const returned = await tx
      .update(eventRegistrations)
      .set({ bibReturnedAt: new Date() })
      .where(
        and(
          eq(eventRegistrations.heatId, heatId),
          isNotNull(eventRegistrations.bib),
          isNull(eventRegistrations.bibReturnedAt),
        ),
      )
      .returning({ id: eventRegistrations.id });

    return { result: "finished", returned: returned.length };
  });
}

export type UnfinishOutcome =
  | { result: "unfinished"; released: number }
  | { result: "not-finished" }
  | { result: "missing" }
  /** Bibs this heat returned that somebody else now holds — nothing was changed. */
  | { result: "conflict"; bibs: number[] };

/**
 * Undo marking a heat finished, re-leasing the bibs it returned.
 *
 * **Fails loudly** rather than partially (ADR 0003): if any of those numbers has
 * since been leased to another runner, the whole reversal is refused and the
 * offending bibs are named. Two runners must never wear the same number at once,
 * and quietly skipping the clashes would leave a heat that reads recoverable but
 * has lost half its chips.
 *
 * Only members still `checked_in` are re-leased. A member reverted to registered
 * or no-show since had their bib released deliberately, and un-finishing the heat
 * is not the place to undo that.
 */
export async function unfinishHeatRow(
  eventSlug: string,
  heatId: string,
): Promise<UnfinishOutcome> {
  const db = getDb();
  return db.transaction(async (tx) => {
    const [heat] = await tx
      .select({ finishedAt: eventHeats.finishedAt })
      .from(eventHeats)
      .where(and(eq(eventHeats.id, heatId), eq(eventHeats.eventSlug, eventSlug)))
      .limit(1);
    if (!heat) return { result: "missing" };
    if (!heat.finishedAt) return { result: "not-finished" };

    const candidates = await tx
      .select({ id: eventRegistrations.id, bib: eventRegistrations.bib })
      .from(eventRegistrations)
      .where(
        and(
          eq(eventRegistrations.heatId, heatId),
          eq(eventRegistrations.status, "checked_in"),
          isNotNull(eventRegistrations.bib),
          isNotNull(eventRegistrations.bibReturnedAt),
        ),
      );

    if (candidates.length > 0) {
      const held = await tx
        .select({ bib: eventRegistrations.bib })
        .from(eventRegistrations)
        .where(
          and(
            eq(eventRegistrations.eventSlug, eventSlug),
            isNotNull(eventRegistrations.bib),
            isNull(eventRegistrations.bibReturnedAt),
          ),
        );
      const heldBibs = new Set(held.map((r) => r.bib as number));

      // Two candidates on the same number would collide with each other, not with
      // an outside holder — same refusal, same reason.
      const seen = new Set<number>();
      const clashes = new Set<number>();
      for (const c of candidates) {
        const bib = c.bib as number;
        if (heldBibs.has(bib) || seen.has(bib)) clashes.add(bib);
        seen.add(bib);
      }
      if (clashes.size > 0) {
        // Nothing has been written yet, so returning here leaves the heat and
        // every lease exactly as they were.
        return { result: "conflict", bibs: [...clashes].sort((a, b) => a - b) };
      }

      await tx
        .update(eventRegistrations)
        .set({ bibReturnedAt: null })
        .where(
          inArray(
            eventRegistrations.id,
            candidates.map((c) => c.id),
          ),
        );
    }

    await tx.update(eventHeats).set({ finishedAt: null }).where(eq(eventHeats.id, heatId));
    return { result: "unfinished", released: candidates.length };
  });
}

/**
 * Move registrations into a heat, or out of every heat when `heatId` is null.
 * `heatId` is a single column, so a runner is in at most one heat by
 * construction — moving them into a heat takes them out of their previous one in
 * the same statement.
 *
 * Scoped by slug so ids from another event are silently ignored rather than
 * dragged across. Returns how many rows moved.
 */
export async function setHeatForRegistrations(
  eventSlug: string,
  heatId: string | null,
  registrationIds: string[],
): Promise<number> {
  if (registrationIds.length === 0) return 0;
  const db = getDb();
  const rows = await db
    .update(eventRegistrations)
    .set({ heatId })
    .where(
      and(
        eq(eventRegistrations.eventSlug, eventSlug),
        inArray(eventRegistrations.id, registrationIds),
      ),
    )
    .returning({ id: eventRegistrations.id });
  return rows.length;
}
