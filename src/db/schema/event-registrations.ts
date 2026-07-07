import { sql } from "drizzle-orm";
import { boolean, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { users } from "./auth";

/**
 * Participation lifecycle for individual events. Live model:
 * `registered → checked_in → no_show`. `cancelled` is **deprecated in code**
 * (never set — see {@link ParticipationStatus}); the physical enum value is
 * retained here because dropping it is not an additive migration.
 */
export const participationStatusEnum = pgEnum("participation_status", [
  "registered",
  "checked_in",
  "no_show",
  "cancelled",
]);

/**
 * The live participation statuses code may set or read. Excludes the deprecated
 * `cancelled` physical enum value so it can never leak into the TS surface.
 */
export type ParticipationStatus = Exclude<
  (typeof participationStatusEnum.enumValues)[number],
  "cancelled"
>;

/**
 * One row per (event, user). Keyed by `event_slug` text (no FK — events live in
 * the config registry, not the DB). All registrations are free; bib is assigned
 * at check-in and is unique per event via a partial unique index.
 */
export const eventRegistrations = pgTable(
  "event_registrations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventSlug: text("event_slug").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: participationStatusEnum("status").default("registered").notNull(),
    bib: integer("bib"),
    terms: boolean("terms").default(false).notNull(),
    locale: text("locale").default("pl").notNull(),
    checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("event_registrations_event_user_uq").on(table.eventSlug, table.userId),
    uniqueIndex("event_registrations_event_bib_uq")
      .on(table.eventSlug, table.bib)
      .where(sql`${table.bib} is not null`),
  ],
);
