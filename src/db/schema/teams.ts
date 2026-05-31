import { pgTable, uuid, text, integer, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const teamStatusEnum = pgEnum("team_status", ["open", "locked", "final", "cancelled"]);

export const teams = pgTable("teams", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  // Captain-declared roster size at registration time (7..12). Nullable
  // because legacy rows from before the schema simplification have no value.
  size: integer("size"),
  status: teamStatusEnum("status").default("open").notNull(),
  freeSlot: boolean("free_slot").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  lockedAt: timestamp("locked_at", { withTimezone: true }),
});
