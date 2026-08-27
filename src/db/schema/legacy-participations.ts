import { boolean, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { users } from "./auth";

/**
 * One row per (event, user) for events that predate the `users` table — today
 * only warsaw-2026, whose registrants live in the frozen legacy `runners`
 * table. Written by the one-time first-event import script, which derives
 * `attended` from the official results file corroborated by legacy check-in.
 * Keyed by `event_slug` text (no FK — events are rows of their own now, but the
 * slug stays the plain text join key across six tables; see ADR 0005).
 */
export const legacyParticipations = pgTable(
  "legacy_participations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    eventSlug: text("event_slug").notNull(),
    attended: boolean("attended").default(false).notNull(),
    teamName: text("team_name"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("legacy_participations_event_user_uq").on(t.eventSlug, t.userId)],
);
