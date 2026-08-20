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
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
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
