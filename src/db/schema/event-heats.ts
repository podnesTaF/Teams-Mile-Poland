import { integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

/**
 * Heats for an individual event. Keyed by `event_slug` text (no FK — events are
 * rows now, but the slug stays the plain text join key across six tables, and
 * the admin delete-guard refuses to remove an event that still has heats rather
 * than leaving that to a cascade; see ADR 0005). `capacity` is capped at the
 * event's `bibPool` by the callers that create/update heats (see ADR 0003).
 *
 * `scheduledAt` is prefilled from the event's racing window on generation and is
 * a stored fact thereafter — never re-derived, because it is the value runners
 * were emailed.
 */
export const eventHeats = pgTable(
  "event_heats",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventSlug: text("event_slug").notNull(),
    /** 1-based heat number within the event. */
    number: integer("number").notNull(),
    capacity: integer("capacity").notNull(),
    /**
     * Capacity counted in **teams** — team events only (PRD #64, "Heats hold
     * whole teams"). Null on every individual heat, where `capacity` is the
     * only bound there is. Bounded by the event's bib pool by the callers that
     * create and edit heats, exactly as `capacity` is (ADR 0003).
     */
    capacityTeams: integer("capacity_teams"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    /**
     * When the heat was actually sent off. Set by an explicit "Mark started"
     * action on the admin teams surface (#69) and read by `swapComposed`, which
     * refuses `heat_started` once this (or `finishedAt`) is stamped.
     *
     * Added because the rules place the swap deadline at the *start* of the
     * heat, and the two timestamps that existed could not express it:
     * `publishedAt` is when the card went public, minutes or hours earlier, and
     * `finishedAt` is when the bibs come back. Deliberately **not** folded into
     * {@link heatState}: that lifecycle is what the public start list renders,
     * and a started heat is still a published one.
     */
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("event_heats_event_number_uq").on(table.eventSlug, table.number)],
);

export type EventHeatRow = typeof eventHeats.$inferSelect;

/**
 * Heat lifecycle. Derived from the two timestamps rather than stored as an enum
 * so it can never drift out of sync with them.
 */
export type HeatState = "draft" | "published" | "finished";

/** The lifecycle state of a heat, derived from `publishedAt` / `finishedAt`. */
export function heatState(heat: Pick<EventHeatRow, "publishedAt" | "finishedAt">): HeatState {
  if (heat.finishedAt) return "finished";
  if (heat.publishedAt) return "published";
  return "draft";
}
