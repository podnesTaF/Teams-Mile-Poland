import { EVENT } from "@/lib/marketing/event";

import { warsaw2026Results } from "./results/warsaw-2026";
import { buildMileTimetable } from "./timetables";
import type { EventSummary, TimeRange } from "./types";

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

/**
 * Every individual mile event in the registry regardless of lifecycle status.
 * Two consumers: the "Aug events" universe the broadcast segments
 * (`registered_any_aug`, `not_registered_aug`, `registered:<slug>`) are computed
 * against, and the event detail page's static params (a completed race night
 * must keep its page — the gallery teaser/back-link and media-live mailing CTA
 * point at it). Unlike {@link getSeriesEvents} this includes completed
 * individual events, so a past event stays reachable. Soonest first.
 */
export function getIndividualEvents(): EventSummary[] {
  return EVENTS.filter((e) => e.eventType === "individual").sort((a, b) =>
    a.date.localeCompare(b.date),
  );
}

/** Look up a single event by slug. */
export function getEventBySlug(slug: string): EventSummary | undefined {
  return EVENTS.find((e) => e.slug === slug);
}

/** Look up a single event by slug, throwing if it does not exist. */
export function getEventOrThrow(slug: string): EventSummary {
  const event = getEventBySlug(slug);
  if (!event) {
    throw new Error(`Unknown event slug: ${slug}`);
  }
  return event;
}
