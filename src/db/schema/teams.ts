import { pgTable, uuid, text, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const teamCategoryEnum = pgEnum("team_category", ["mens", "womens", "mixed"]);
export const teamStatusEnum = pgEnum("team_status", ["open", "locked", "final", "cancelled"]);

export const teams = pgTable("teams", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  category: teamCategoryEnum("category").notNull(),
  region: text("region").notNull(),
  status: teamStatusEnum("status").default("open").notNull(),
  freeSlot: boolean("free_slot").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  lockedAt: timestamp("locked_at", { withTimezone: true }),
});
