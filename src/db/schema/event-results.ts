import { sql } from "drizzle-orm";
import { integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { eventRegistrations } from "./event-registrations";
import { teamResults } from "./team-results";
// Type-only and relative, like `team-entries.ts`: drizzle-kit loads schema
// files outside the Next.js toolchain, and the module is erased before it runs.
import type { RaceRole } from "../../features/teams/rating-rules";

/**
 * How a runner's race ended, as the timing system recorded it. Plain text +
 * `$type` rather than a pgEnum — `ALTER TYPE … ADD VALUE` cannot run inside a
 * transaction and stranded migration 0012 on the live DB; `users.role` set the
 * precedent this follows.
 */
export type ResultStatus = "finished" | "dnf" | "dns" | "dsq";

export const RESULT_STATUSES: readonly ResultStatus[] = ["finished", "dnf", "dns", "dsq"];

/**
 * One timing point a runner crossed: the distance of the mat from the start
 * line and the gun-relative time there, as the timing export recorded them
 * (RaceResult's `9 m`, `109 m` … `1609 m` columns — the first mat sits 9 m
 * past the line, then one every 100 m). Cumulative, never per-lap: a lap is a
 * difference two readers can compute, a missing cumulative reading cannot be.
 */
export type ResultSplit = { m: number; cs: number };

/**
 * One timing-system result row for an individual event. Keyed by `event_slug`
 * text (no FK — events are rows now, but the slug stays the plain text join key
 * across six tables; deleting an event that has results is refused by the admin
 * guard rather than cascaded away, since a race that ran keeps its record. See
 * ADR 0005).
 *
 * Identity is `(event_slug, heat_number, bib)` for an individual row: bibs are
 * recycled leases across heats within one event, so a bib alone never
 * identifies a result (ADR 0003). A row that ran for a team is identified by
 * `(team_result_id, bib)` instead — two teams in one heat wear the same seat
 * numbers (22.09: both teams had bibs 3, 5, 7, 8), and the timing file can
 * carry a team runner with no bib at all, so `bib` is nullable (ADR 0014).
 * `heat_number` is the config/sheet heat number rather than an `event_heats` FK
 * so rows survive heat-row deletion and legacy events without heat rows can be
 * backfilled.
 *
 * Rows are written only by the admin results import, which replaces an entire
 * heat per commit — re-importing a corrected timing file is idempotent.
 */
export const eventResults = pgTable(
  "event_results",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventSlug: text("event_slug").notNull(),
    /** 1-based heat number — the stable half of the (heat, bib) identity. */
    heatNumber: integer("heat_number").notNull(),
    /** Null only on a team row the timing file recorded without a bib. */
    bib: integer("bib"),
    status: text("status").$type<ResultStatus>().default("finished").notNull(),
    /**
     * Net mile time in hundredths of a second; null unless `status` is
     * `finished` — and null for a team PACER or JOKER, who never runs a whole
     * mile (their leg is {@link legTimeCs}). Every reader that ranks miles reads
     * this column, so a partial leg can never masquerade as a mile.
     */
    timeCs: integer("time_cs"),
    /** Finishing place within the heat; null unless `status` is `finished`. */
    place: integer("place"),
    /** Name exactly as the timing system recorded it (may be surname-first). */
    name: text("name").notNull(),
    gender: text("gender").$type<"M" | "F">().notNull(),
    /**
     * Resolved at import time via the (heat, bib) bib lease, falling back to a
     * unique name-key match — never guessed, left null when neither resolves.
     * Read-time name matching remains the fallback for null (see
     * `findUserResults`).
     */
    registrationId: uuid("registration_id").references(() => eventRegistrations.id, {
      onDelete: "set null",
    }),
    /** Every timing point crossed, in distance order; null when the file had none. */
    splits: jsonb("splits").$type<ResultSplit[]>(),
    /** The team result this row counts toward; null for an individual run. */
    teamResultId: uuid("team_result_id").references(() => teamResults.id, {
      onDelete: "cascade",
    }),
    /**
     * RACER (a whole mile), ACE (the timing file's "Pacer": first leg of a
     * pair) or JOKER (second leg). Null for an individual run.
     */
    raceRole: text("race_role").$type<RaceRole>(),
    /** 1 or 2 for an ACE/JOKER — which pair of the team. Null otherwise. */
    pairNo: integer("pair_no"),
    /**
     * Where an ACE/JOKER leg ended, gun-relative, as the timing file gives it:
     * the ACE's handover reading, the JOKER's finish (which is the pair's mile).
     * Null for RACERS and individuals, whose figure is {@link timeCs}.
     */
    legTimeCs: integer("leg_time_cs"),
    importedAt: timestamp("imported_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("event_results_event_heat_bib_uq")
      .on(table.eventSlug, table.heatNumber, table.bib)
      .where(sql`${table.teamResultId} is null`),
    uniqueIndex("event_results_team_bib_uq")
      .on(table.teamResultId, table.bib)
      .where(sql`${table.teamResultId} is not null`),
  ],
);

export type EventResultRow = typeof eventResults.$inferSelect;
