import type { EventSummary } from "@/lib/events/types";

/**
 * Parameterized lifecycle scheduling for individual events — the registry-driven
 * counterpart to the legacy `mailings/schedule.ts` (which is hardcoded to the
 * single June event). Every send time derives from the event's `date` +
 * `timeRange`, so each mile night gets its own chain. No captain nudge.
 *
 * Pure functions (take `now` + `event`) so they're testable and safe from cron.
 */

export const EVENT_SCHEDULED_KINDS = [
  "reminder_7d",
  "reminder_3d",
  "reminder_1d",
  "morning",
] as const;

export type EventScheduledKind = (typeof EVENT_SCHEDULED_KINDS)[number];

const OFFSET_DAYS: Record<EventScheduledKind, number> = {
  reminder_7d: 7,
  reminder_3d: 3,
  reminder_1d: 1,
  morning: 0,
};

// Local hour each kind goes out (reminders 09:00; morning-of 08:00).
const SEND_HOUR_LOCAL: Record<EventScheduledKind, number> = {
  reminder_7d: 9,
  reminder_3d: 9,
  reminder_1d: 9,
  morning: 8,
};

const CEST_OFFSET_HOURS = 2; // Warsaw summer offset (the series runs in August)
const DAY_MS = 86_400_000;

function eventMidnightUtcMs(event: EventSummary): number {
  return Date.parse(`${event.date}T00:00:00Z`);
}

/** Parse "HH:MM" → fractional hours (e.g. "09:15" → 9.25). */
function hoursOf(time: string, fallback: number): number {
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h)) return fallback;
  return h + (Number.isNaN(m) ? 0 : m / 60);
}

/** UTC instant a given kind should be sent for this event. */
export function sendAt(kind: EventScheduledKind, event: EventSummary): Date {
  const utcHour = SEND_HOUR_LOCAL[kind] - CEST_OFFSET_HOURS;
  return new Date(eventMidnightUtcMs(event) - OFFSET_DAYS[kind] * DAY_MS + utcHour * 3_600_000);
}

/** Event start / end (local wall-clock from timeRange) as UTC instants. */
export function eventStart(event: EventSummary): Date {
  const startLocal = hoursOf(event.timeRange?.start ?? "09:00", 9);
  return new Date(eventMidnightUtcMs(event) + (startLocal - CEST_OFFSET_HOURS) * 3_600_000);
}
export function eventEnd(event: EventSummary): Date {
  const endLocal = hoursOf(event.timeRange?.end ?? "12:00", 12);
  return new Date(eventMidnightUtcMs(event) + (endLocal - CEST_OFFSET_HOURS) * 3_600_000);
}

/** The single scheduled kind whose window contains `now` for this event, or null. */
export function dueScheduledKind(now: Date, event: EventSummary): EventScheduledKind | null {
  if (now.getTime() > eventEnd(event).getTime()) return null;
  let due: EventScheduledKind | null = null;
  for (const kind of EVENT_SCHEDULED_KINDS) {
    if (sendAt(kind, event).getTime() <= now.getTime()) due = kind;
  }
  return due;
}
