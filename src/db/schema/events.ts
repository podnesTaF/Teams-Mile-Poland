import { date, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { users } from "./auth";
// Relative on purpose: drizzle-kit loads schema files outside the Next.js
// toolchain, where the `@/` alias may not resolve.
import {
  DEFAULT_BIB_POOL,
  DEFAULT_HEAT_INTERVAL_MINUTES,
  type EventStatus,
  type EventType,
} from "../../lib/events/types";

/**
 * The event registry, as data. Until now which events exist and what state each
 * is in was compile-time config (`src/lib/events/registry.ts` exported a literal
 * `EVENTS` array), so opening a race night for registration meant a code edit
 * and a deploy — and cancelling one meant deleting its entry outright and
 * re-slugging its registrations by hand, which is what happened to the
 * 2026-08-08 night. One row per event makes the lifecycle an admin action.
 *
 * `slug` is the primary key because it is already the join key: six tables key
 * off `event_slug` text with no FK (`event_registrations`, `event_results`,
 * `event_heats`, `event_media`, `event_email_log`, plus the ticket signature
 * payload). That is also why a slug is generated once and never rewritten —
 * renaming one strands rows in all six.
 *
 * `status` and `event_type` are `text` + `$type<>` rather than pgEnum:
 * `ALTER TYPE … ADD VALUE` cannot run inside a transaction and stranded
 * migration 0012 on the live DB (see `event-results.ts`, `wallet.ts` and
 * `auth.ts`), and the status set is about to grow — `draft` and `cancelled` are
 * next. The exhaustiveness that matters is the compiler's: {@link EventStatus}
 * is used as a total `Record` key in three places, so adding a value there
 * enumerates the work with no migration at all.
 *
 * Nothing here is derived. `shortDate`, the display `timeRange` and the on-site
 * `timetable` are all computed in `src/lib/events/store.ts` when a row is mapped
 * to an `EventSummary` — every night in the series runs the same flow, so the
 * timetable follows from the start time and is not an editable field.
 */
export const events = pgTable("events", {
  slug: text("slug").primaryKey(),
  status: text("status").$type<EventStatus>().notNull(),
  eventType: text("event_type").$type<EventType>().notNull(),
  name: text("name").notNull(),
  /**
   * `mode: "string"` is load-bearing, not a preference: `EventSummary.date` is
   * ordered with `localeCompare` and parsed by `parseDateOnly`, both of which
   * want the bare `YYYY-MM-DD`. A `Date` here would silently re-introduce a
   * timezone into a date that has none.
   */
  date: date("date", { mode: "string" }).notNull(),
  /** Wall-clock "HH:MM" window. Null for the legacy team event, which has none. */
  startTime: text("start_time"),
  endTime: text("end_time"),
  venue: text("venue").notNull(),
  city: text("city").notNull(),
  /** Physical bibs the timing system supplies; bibs are leases from `1..bibPool` (ADR 0003). */
  bibPool: integer("bib_pool").default(DEFAULT_BIB_POOL).notNull(),
  /** Spacing used to prefill *newly* generated heat times; never moves a stored one. */
  heatIntervalMinutes: integer("heat_interval_minutes")
    .default(DEFAULT_HEAT_INTERVAL_MINUTES)
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  /** The admin who created it; null for the rows seeded from the old registry. */
  createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
});

export type EventRow = typeof events.$inferSelect;
