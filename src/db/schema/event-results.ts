import { integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { eventRegistrations } from "./event-registrations";

/**
 * How a runner's race ended, as the timing system recorded it. Plain text +
 * `$type` rather than a pgEnum — `ALTER TYPE … ADD VALUE` cannot run inside a
 * transaction and stranded migration 0012 on the live DB; `users.role` set the
 * precedent this follows.
 */
export type ResultStatus = "finished" | "dnf" | "dns" | "dsq";

export const RESULT_STATUSES: readonly ResultStatus[] = ["finished", "dnf", "dns", "dsq"];

/**
 * One timing-system result row for an individual event. Keyed by `event_slug`
 * text (no FK — events are rows now, but the slug stays the plain text join key
 * across six tables; deleting an event that has results is refused by the admin
 * guard rather than cascaded away, since a race that ran keeps its record. See
 * ADR 0005).
 *
 * Identity is `(event_slug, heat_number, bib)`: bibs are recycled leases across
 * heats within one event, so a bib alone never identifies a result (ADR 0003).
 * `heat_number` is the config/sheet heat number rather than an `event_heats` FK
 * so rows survive heat-row deletion and legacy events without heat rows can be
 * backfilled.
 *
 * Rows are written only by the admin results import, which replaces an entire
 * heat per commit — re-importing a corrected timing file is idempotent.
 */
export const eventResults = pgTable(
  "event_results",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventSlug: text("event_slug").notNull(),
    /** 1-based heat number — the stable half of the (heat, bib) identity. */
    heatNumber: integer("heat_number").notNull(),
    bib: integer("bib").notNull(),
    status: text("status").$type<ResultStatus>().default("finished").notNull(),
    /** Net time in hundredths of a second; null unless `status` is `finished`. */
    timeCs: integer("time_cs"),
    /** Finishing place within the heat; null unless `status` is `finished`. */
    place: integer("place"),
    /** Name exactly as the timing system recorded it (may be surname-first). */
    name: text("name").notNull(),
    gender: text("gender").$type<"M" | "F">().notNull(),
    /**
     * Resolved at import time via the (heat, bib) bib lease, falling back to a
     * unique name-key match — never guessed, left null when neither resolves.
     * Read-time name matching remains the fallback for null (see
     * `findUserResults`).
     */
    registrationId: uuid("registration_id").references(() => eventRegistrations.id, {
      onDelete: "set null",
    }),
    importedAt: timestamp("imported_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("event_results_event_heat_bib_uq").on(
      table.eventSlug,
      table.heatNumber,
      table.bib,
    ),
  ],
);

export type EventResultRow = typeof eventResults.$inferSelect;
