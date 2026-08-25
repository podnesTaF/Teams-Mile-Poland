import { sql } from "drizzle-orm";
import { boolean, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { users } from "./auth";
import { eventHeats } from "./event-heats";

/**
 * Participation lifecycle for individual events. Live model:
 * `registered → confirmed → checked_in → no_show`. `confirmed` is the runner's
 * own remote "I am coming" (see `confirmedAt`); `checked_in` is the admin's
 * on-site verification of arrival. `cancelled` is **deprecated in code**
 * (never set — see {@link ParticipationStatus}); the physical enum value is
 * retained here because dropping it is not an additive migration.
 */
export const participationStatusEnum = pgEnum("participation_status", [
  "registered",
  "confirmed",
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
 * One row per (event, user). Keyed by `event_slug` text (no FK — events are rows
 * now, but the slug remains the stable join key for six tables, and an event
 * with registrations is never hard-deleted: the admin guard refuses and offers
 * `cancelled` instead, which is a better failure than a cascade. See ADR 0005).
 * All registrations are free.
 *
 * A bib is a **lease**, not an identity (ADR 0003): it is issued at check-in and
 * returned when the runner's heat is marked finished, which stamps
 * `bibReturnedAt`. The partial unique index therefore encodes "held by at most
 * one runner at a time" rather than "one bib per registration for the event".
 * The `bib` value itself is retained after return so historical results stay
 * accurate.
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
    /** Set while the runner holds the bib lease; stamped when it returns to the pool. */
    bibReturnedAt: timestamp("bib_returned_at", { withTimezone: true }),
    terms: boolean("terms").default(false).notNull(),
    locale: text("locale").default("pl").notNull(),
    /** The heat the runner is seeded into; cleared if the heat is deleted. */
    heatId: uuid("heat_id").references(() => eventHeats.id, { onDelete: "set null" }),
    /** When the runner confirmed they are coming (remote, pre-race). */
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    /** Heat / start time the runner was last emailed — drives the publish delta. */
    notifiedHeatId: uuid("notified_heat_id"),
    notifiedHeatTime: timestamp("notified_heat_time", { withTimezone: true }),
    checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("event_registrations_event_user_uq").on(table.eventSlug, table.userId),
    uniqueIndex("event_registrations_event_bib_held_uq")
      .on(table.eventSlug, table.bib)
      .where(sql`${table.bib} is not null and ${table.bibReturnedAt} is null`),
  ],
);
