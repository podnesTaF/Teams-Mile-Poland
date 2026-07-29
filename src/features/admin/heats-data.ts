import { and, asc, eq, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";

import {
  eventHeats,
  eventRegistrations,
  heatState,
  users,
  type HeatState,
  type ParticipationStatus,
} from "@/db/schema";
import { getDb } from "@/lib/db";

/** A heat plus how full it is — the unit the builder renders. */
export type HeatWithFill = {
  id: string;
  number: number;
  capacity: number;
  scheduledAt: Date;
  publishedAt: Date | null;
  finishedAt: Date | null;
  state: HeatState;
  /** Registrations currently seeded into this heat. */
  fill: number;
  /** Bib leases its members are still holding — what finishing it would free. */
  bibsHeld: number;
};

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
 */
export async function getEventHeats(eventSlug: string): Promise<HeatWithFill[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: eventHeats.id,
      number: eventHeats.number,
      capacity: eventHeats.capacity,
      scheduledAt: eventHeats.scheduledAt,
      publishedAt: eventHeats.publishedAt,
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

  return rows.map((r) => ({ ...r, state: heatState(r) }));
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
 */
export async function createHeats(
  eventSlug: string,
  opts: { count: number; capacity: number; firstStart: Date; intervalMinutes: number },
): Promise<number> {
  const db = getDb();
  const from = await maxHeatNumber(eventSlug);
  const values = Array.from({ length: opts.count }, (_, i) => ({
    eventSlug,
    number: from + i + 1,
    capacity: opts.capacity,
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
  patch: { capacity?: number; scheduledAt?: Date },
): Promise<"updated" | "missing" | "nothing-to-do"> {
  if (patch.capacity === undefined && patch.scheduledAt === undefined) return "nothing-to-do";
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
