import { integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { users } from "./auth";

/**
 * Admin-composed mailings to segments of `users` — the user-keyed sibling of
 * the frozen legacy `broadcasts` table (which targets legacy runners/teams).
 * `segment` is text, not an enum, because segments include parameterized
 * values (`registered:<event-slug>`) resolved at send time; see the PRD's
 * segment identifiers. Statuses: `draft` | `sent`.
 */
export const userBroadcasts = pgTable("user_broadcasts", {
  id: uuid("id").defaultRandom().primaryKey(),
  subject: text("subject").notNull(),
  bodyHtml: text("body_html").notNull(),
  segment: text("segment").notNull(),
  status: text("status").default("draft").notNull(),
  sentCount: integer("sent_count").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Per-(user, broadcast) send log; the unique index is the dedup guarantee that
 * a retried send never double-emails anyone (insert with conflict-ignore).
 */
export const userBroadcastLog = pgTable(
  "user_broadcast_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    broadcastId: uuid("broadcast_id")
      .notNull()
      .references(() => userBroadcasts.id, { onDelete: "cascade" }),
    status: text("status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("user_broadcast_log_user_broadcast_uq").on(t.userId, t.broadcastId)],
);
