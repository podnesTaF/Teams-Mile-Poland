import { EVENT } from "@/lib/marketing/event";

import { warsaw2026Results } from "./results/warsaw-2026";
import type { EventSummary } from "./types";

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
    name: EVENT.name,
    date: EVENT.date,
    shortDate: EVENT.shortDate,
    venue: EVENT.venue.name,
    city: EVENT.venue.city,
    results: warsaw2026Results,
  },
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
