import { EVENT } from "@/lib/marketing/event";

import type { TimeRange } from "./types";

/**
 * What is left of the event registry once events became rows.
 *
 * This module used to *be* the source of truth: a literal `EVENTS` array plus
 * the selectors over it. The records now live in the `events` table and are read
 * by `store.ts`, which this file re-exports so all ~41 consumers keep importing
 * `@/lib/events/registry` and changed only by gaining an `await`. Two things
 * that were never really registry data stayed behind: the two time windows the
 * series actually runs (form defaults now, not entries), and the shared
 * venue/brand facts, which live in `@/lib/marketing/event` and are referenced
 * here rather than duplicated.
 *
 * The hand-transcribed results sheets moved to `results-sheets.ts`, so the
 * reader can import them without a cycle through this file.
 *
 * Historical note kept because it is the reason `cancelled` is being added: the
 * 2026-08-08 night was **cancelled and removed from the registry outright**
 * rather than parked in a lifecycle state — the model had no `cancelled` status,
 * and leaving it as `registration_closed` read as a race still happening with
 * entries shut. Its 11 registrations were re-slugged to 08-15 by hand first, so
 * no row keyed a slug the registry no longer knew. That is also why a slug is
 * generated once and never rewritten.
 */

/** Morning window for the alternating race nights — a create-form default. */
export const MORNING: TimeRange = { start: "09:15", end: "12:15" };

/** Evening window for the alternating race nights — a create-form default. */
export const EVENING: TimeRange = { start: "17:30", end: "20:30" };

/**
 * The venue every event in the series has run at so far, as create-form
 * defaults. Kept derived from the marketing facts rather than retyped.
 */
export const DEFAULT_VENUE = { venue: EVENT.venue.name, city: EVENT.venue.city } as const;

export {
  getBibPool,
  getBibSlots,
  getEventBySlug,
  getEventOrThrow,
  getFeaturedEvent,
  getFirstHeatTime,
  getHeatIntervalMinutes,
  getIndividualEvents,
  getOpenEvents,
  getPastEvents,
  getResultsEvents,
  getSeriesEvents,
  getUpcomingEvents,
  isRegistrationOpen,
} from "./store";
