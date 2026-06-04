import { pgTable, uuid, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";

import { teams } from "./teams";

// Audience a broadcast targets. "team" pairs with `teamId`.
export const broadcastSegmentEnum = pgEnum("broadcast_segment", [
  "all",
  "captains",
  "team_members",
  "free_agents",
  "team",
]);

export const broadcastStatusEnum = pgEnum("broadcast_status", ["draft", "sent"]);

// Ad-hoc admin-composed mailings (one-off announcements to a segment).
export const broadcasts = pgTable("broadcasts", {
  id: uuid("id").defaultRandom().primaryKey(),
  subject: text("subject").notNull(),
  bodyHtml: text("body_html").notNull(),
  segment: broadcastSegmentEnum("segment").notNull(),
  teamId: uuid("team_id").references(() => teams.id),
  status: broadcastStatusEnum("status").default("draft").notNull(),
  sentCount: integer("sent_count").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
