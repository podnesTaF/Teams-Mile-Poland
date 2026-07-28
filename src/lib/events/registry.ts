import { EVENT } from "@/lib/marketing/event";

import { warsaw2026Results } from "./results/warsaw-2026";
import { buildMileTimetable, firstHeatTime } from "./timetables";
import {
  DEFAULT_BIB_POOL,
  DEFAULT_HEAT_INTERVAL_MINUTES,
  type EventSummary,
  type TimeRange,
} from "./types";

/**
 * Shared config for the Aug-2026 individual mile series — same venue for every
 * event. Registration is free and uncapped. Only the date/time differs, so the
 * registry entries below stay one line of intent each.
 */
const MORNING: TimeRange = { start: "09:15", end: "12:15" };
// Evening window for the alternating race nights.
const EVENING: TimeRange = { start: "17:30", end: "20:30" };

/** Build one individual mile-series entry from its date + time window. */
function mileEvent(
  date: string,
  timeRange: TimeRange,
  status: EventSummary["status"] = "upcoming",
): EventSummary {
  const [y, m, d] = date.split("-");
  return {
    slug: `mile-${date}`,
    status,
    eventType: "individual",
    name: "Individual Mile",
    date,
    shortDate: `${d} · ${m} · ${y}`,
    venue: EVENT.venue.name,
    city: EVENT.venue.city,
    timeRange,
    timetable: buildMileTimetable(timeRange.start),
    bibPool: DEFAULT_BIB_POOL,
    heatIntervalMinutes: DEFAULT_HEAT_INTERVAL_MINUTES,
  };
}

/**
 * The event registry — the single source of truth for which events exist and
 * what state each is in. Add a new entry per event; flip `status` as it moves
 * through its lifecycle. Shared, non-event data (contact, brand) lives in
 * `@/lib/marketing/event` and is referenced here, not duplicated.
 */
export const EVENTS: EventSummary[] = [
  {
    slug: "warsaw-2026",
    status: "completed",
    eventType: "team",
    name: EVENT.name,
    date: EVENT.date,
    shortDate: EVENT.shortDate,
    venue: EVENT.venue.name,
    city: EVENT.venue.city,
    results: warsaw2026Results,
  },
  // Aug-2026 individual mile series. The first night is open; the rest are
  // announced ("opens soon") until their registration windows open.
  mileEvent("2026-08-01", MORNING, "registration_open"),
  mileEvent("2026-08-08", EVENING),
  mileEvent("2026-08-15", MORNING),
  mileEvent("2026-08-22", EVENING),
  mileEvent("2026-08-29", MORNING),
];

/**
 * The "next" event the site should promote: the soonest event that has not yet
 * happened. Returns `null` when nothing is scheduled (the current state).
 */
export function getFeaturedEvent(): EventSummary | null {
  const scheduled = EVENTS.filter((e) => e.status !== "completed").sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  return scheduled[0] ?? null;
}

/** Completed events, newest first. */
export function getPastEvents(): EventSummary[] {
  return EVENTS.filter((e) => e.status === "completed").sort((a, b) =>
    b.date.localeCompare(a.date),
  );
}

/** The most recent completed event that has results, if any. */
export function getLatestResults(): EventSummary | null {
  return getPastEvents().find((e) => e.results) ?? null;
}

/** Whether the featured event is currently accepting registrations. */
export function isRegistrationOpen(event: EventSummary | null): boolean {
  return event?.status === "registration_open";
}

/** Events accepting registrations now, soonest first. */
export function getOpenEvents(): EventSummary[] {
  return EVENTS.filter((e) => e.status === "registration_open").sort((a, b) =>
    a.date.localeCompare(b.date),
  );
}

/** Announced-but-not-yet-open events, soonest first. */
export function getUpcomingEvents(): EventSummary[] {
  return EVENTS.filter((e) => e.status === "upcoming").sort((a, b) =>
    a.date.localeCompare(b.date),
  );
}

/**
 * The individual mile series, soonest first — every non-completed individual
 * event regardless of open/upcoming state. Drives the landing cards section.
 */
export function getSeriesEvents(): EventSummary[] {
  return EVENTS.filter((e) => e.eventType === "individual" && e.status !== "completed").sort(
    (a, b) => a.date.localeCompare(b.date),
  );
}

/** Look up a single event by slug. */
export function getEventBySlug(slug: string): EventSummary | undefined {
  return EVENTS.find((e) => e.slug === slug);
}

/**
 * The bib pool an event draws leases from (ADR 0003), falling back to the series
 * default for events whose config omits it. Pool size is config, not data.
 */
export function getBibPool(slug: string): number {
  return getEventBySlug(slug)?.bibPool ?? DEFAULT_BIB_POOL;
}

/**
 * Spacing used to prefill generated heat start times, falling back to the series
 * default. Like the pool size this is config: once a heat is generated its
 * `scheduledAt` is a stored fact and editing the registry never moves it.
 */
export function getHeatIntervalMinutes(slug: string): number {
  return getEventBySlug(slug)?.heatIntervalMinutes ?? DEFAULT_HEAT_INTERVAL_MINUTES;
}

/**
 * Wall-clock time ("HH:MM") the first heat of an event can start — the moment its
 * racing window opens. `null` for events with no configured window.
 */
export function getFirstHeatTime(slug: string): string | null {
  const start = getEventBySlug(slug)?.timeRange?.start;
  return start ? firstHeatTime(start) : null;
}

/** Look up a single event by slug, throwing if it does not exist. */
export function getEventOrThrow(slug: string): EventSummary {
  const event = getEventBySlug(slug);
  if (!event) {
    throw new Error(`Unknown event slug: ${slug}`);
  }
  return event;
}
