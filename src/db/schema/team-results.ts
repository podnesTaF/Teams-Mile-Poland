import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { userTeams } from "./user-teams";
import type { ResultStatus } from "./event-results";

/**
 * One team's run in one heat, exactly as the timing file scored it (ADR 0014):
 * the team's place in the heat and its team time — on 22.09 the sum of the
 * team's four miles (two RACERS, two ACE+JOKER pairs). The runners' own rows
 * live in `event_results` and point here through `team_result_id`.
 *
 * Imported, not derived. PRD #65 wants team time computed from zone readings
 * against the check-in composition; the first team night ran without any
 * platform team entry, so the file is the only record of who raced for whom.
 * The PRD's derived model can later fill these same columns from readings.
 *
 * Keyed by `(event_slug, heat_number, team_name)`: a team can race twice in a
 * night (22.09: both teams ran heat 3 again), so the team alone is not unique.
 * `event_slug` is text with no FK, like every other event table (ADR 0005).
 * Rewritten with the heat by the per-heat replace, same as `event_results`.
 */
export const teamResults = pgTable(
  "team_results",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventSlug: text("event_slug").notNull(),
    heatNumber: integer("heat_number").notNull(),
    /** The team name as the timing file spelled it. */
    teamName: text("team_name").notNull(),
    /**
     * The platform team, when the name resolves to exactly one — never guessed.
     * `set null`: a dissolved team must not take its race record with it.
     */
    teamId: uuid("team_id").references(() => userTeams.id, { onDelete: "set null" }),
    status: text("status").$type<ResultStatus>().default("finished").notNull(),
    /** Place within the heat; null unless `status` is `finished`. */
    place: integer("place"),
    /** Team time in hundredths of a second; null unless `status` is `finished`. */
    timeCs: integer("time_cs"),
    importedAt: timestamp("imported_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("team_results_event_heat_team_uq").on(
      table.eventSlug,
      table.heatNumber,
      table.teamName,
    ),
    index("team_results_team_idx").on(table.teamId),
  ],
);

export type TeamResultRow = typeof teamResults.$inferSelect;
