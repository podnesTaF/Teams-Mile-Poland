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
  /**
   * Explicit bib numbers to issue instead of `1..bibPool`, as the normalized
   * spec `lib/events/bib-slots.ts` writes ("101-115, 203") — the "list of
   * remaining numbers" case, where the venue's box is not a neat prefix. Null
   * means no list: leases keep drawing from `1..bibPool`, so every existing
   * row behaves exactly as before this column existed.
   */
  bibSlots: text("bib_slots"),
  /** Spacing used to prefill *newly* generated heat times; never moves a stored one. */
  heatIntervalMinutes: integer("heat_interval_minutes")
    .default(DEFAULT_HEAT_INTERVAL_MINUTES)
    .notNull(),
  /**
   * What entering this night costs, in **whole ACER**, per team entry (ADR
   * 0013). `0` — the default, and every row until an admin prices one — means
   * free, and skips the debit entirely rather than writing a zero-amount
   * ledger row.
   *
   * A price lives on the event rather than in `features/wallet/config.ts`
   * because events are data, not config (ADR 0005): pricing the two October
   * nights is an admin edit, not a deploy, and every other night stays free
   * without anyone naming it. Whole ACER, not minor units, because that is the
   * unit the admin types and the unit every other price constant is in;
   * `acerToMinor` converts at the debit.
   *
   * The fee **charged** is the fee at the moment of entry, recorded in the
   * ledger row. Re-pricing a night never retro-charges an entry already made
   * and never retro-refunds one: the ledger is append-only, and a price change
   * is a fact of its own.
   */
  teamEntryFeeAcer: integer("team_entry_fee_acer").default(0).notNull(),
  /** Per-runner entry fee in whole ACER; see {@link events}.`teamEntryFeeAcer`. */
  individualEntryFeeAcer: integer("individual_entry_fee_acer").default(0).notNull(),
  /**
   * Entry fee for one individual registration, in whole PLN, taken by card
   * through Stripe Checkout before the registration is written (ADR 0015).
   * 0 = free. Supersedes `individualEntryFeeAcer` for new pricing: ACER is a
   * reward currency, and the admin form no longer offers the ACER fee.
   */
  individualPricePln: integer("individual_price_pln").default(0).notNull(),
  /** Entry fee for one team entry, in whole PLN, paid once by the manager via Stripe. 0 = free. */
  teamPricePln: integer("team_price_pln").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  /** The admin who created it; null for the rows seeded from the old registry. */
  createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
});

export type EventRow = typeof events.$inferSelect;
