import { pgTable, text, uuid, timestamp } from "drizzle-orm/pg-core";
import { teams } from "./teams";
import { runners } from "./runners";

export const magicLinks = pgTable("magic_links", {
  token: text("token").primaryKey(),
  email: text("email").notNull(),
  teamId: uuid("team_id").references(() => teams.id),
  runnerId: uuid("runner_id").references(() => runners.id),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
