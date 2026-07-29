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
 * Heats for an event, lowest number first, each with its fill count.
 *
 * Fill counts every seeded registration regardless of status: a runner occupies a
 * lane on the card whether or not they have checked in yet.
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
