import type { TimetableBlock } from "../types";

/** Add `minutes` to a "HH:MM" wall-clock string, returning "HH:MM". */
function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** "HH:MM–HH:MM" span starting at `start`, `duration` minutes long. */
function span(start: string, from: number, to: number): string {
  return `${addMinutes(start, from)}–${addMinutes(start, to)}`;
}

/** Minutes from the event's window start to the moment the racing window opens. */
const HEATS_OFFSET_MINUTES = 60;

/**
 * Wall-clock time the first heat can run, for an event window starting at
 * `start`. The heat builder prefills generated heat times from here, so it stays
 * in step with the timetable block below rather than repeating the offset.
 */
export function firstHeatTime(start: string): string {
  return addMinutes(start, HEATS_OFFSET_MINUTES);
}

/**
 * The on-site schedule for a single 3-hour individual-mile block. Every event
 * in the series runs the same flow at the same stadium — only the start time
 * differs (two patterns: 09:15 morning, 17:30 evening), so the whole timetable
 * is derived from `start`. Heat grouping is manual, so heats are shown as one
 * open racing window rather than fixed per-heat rows.
 *
 * Labels are i18n keys under `events.timetable`, resolved at render time.
 */
export function buildMileTimetable(start: string): TimetableBlock[] {
  return [
    { time: span(start, 0, 45), labelKey: "checkin" },
    { time: span(start, 45, 60), labelKey: "briefing" },
    { time: span(start, HEATS_OFFSET_MINUTES, 150), labelKey: "heats" },
    { time: span(start, 150, 165), labelKey: "cooldown" },
    { time: span(start, 165, 180), labelKey: "awards" },
  ];
}
