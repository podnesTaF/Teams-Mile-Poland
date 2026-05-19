import { sql } from "drizzle-orm";
import { check, integer, pgTable, timestamp } from "drizzle-orm/pg-core";

// Single-row table guarding atomic slot claims.
// Seed once with id=1. Use UPDATE ... WHERE ... < CAP RETURNING for atomic claim.
export const slotCounter = pgTable(
  "slot_counter",
  {
    id: integer("id").default(1).primaryKey(),
    freeTeamsClaimed: integer("free_teams_claimed").default(0).notNull(),
    freeRunnersClaimed: integer("free_runners_claimed").default(0).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [check("slot_counter_singleton_id", sql`${table.id} = 1`)],
);
