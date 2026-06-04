import { EVENT } from "@/lib/marketing/event";
import type { LifecycleKind } from "@/emails/lifecycle/copy";

/**
 * Send-time logic for the lifecycle chain. Pure (takes `now` in) so it's
 * trivially testable and safe to call from cron, admin actions, and the UI.
 *
 * Windows are contiguous, so at any instant at most ONE scheduled reminder
 * is "due" — the one whose window contains `now`. That means a runner who
 * registers at −5 days never receives the "2 weeks to go" email; they enter
 * the chain at the currently-active reminder. Idempotency (email_log) makes
 * each kind send at most once per runner.
 */

// Scheduled reminders, earliest → latest send time.
export const SCHEDULED_KINDS = [
  "reminder_14d",
  "reminder_7d",
  "reminder_3d",
  "reminder_1d",
  "morning",
] as const;

export type ScheduledKind = (typeof SCHEDULED_KINDS)[number];

const OFFSET_DAYS: Record<ScheduledKind, number> = {
  reminder_14d: 14,
  reminder_7d: 7,
  reminder_3d: 3,
  reminder_1d: 1,
  morning: 0,
};

// Local hour each kind goes out (reminders 09:00, morning-of 08:00).
const SEND_HOUR_LOCAL: Record<ScheduledKind, number> = {
  reminder_14d: 9,
  reminder_7d: 9,
  reminder_3d: 9,
  reminder_1d: 9,
  morning: 8,
};

const CEST_OFFSET_HOURS = 2; // Warsaw summer offset (event is in late June)
const DAY_MS = 86_400_000;

function eventMidnightUtcMs() {
  return Date.parse(`${EVENT.date}T00:00:00Z`);
}

/** UTC instant a given scheduled kind should be sent. */
export function sendAt(kind: ScheduledKind): Date {
  const utcHour = SEND_HOUR_LOCAL[kind] - CEST_OFFSET_HOURS;
  return new Date(eventMidnightUtcMs() - OFFSET_DAYS[kind] * DAY_MS + utcHour * 3_600_000);
}

/** Event start (09:00 local) and end (15:30 local) as UTC instants. */
export function eventStart(): Date {
  return new Date(eventMidnightUtcMs() + (9 - CEST_OFFSET_HOURS) * 3_600_000);
}
export function eventEnd(): Date {
  return new Date(eventMidnightUtcMs() + (15.5 - CEST_OFFSET_HOURS) * 3_600_000);
}

/** The single scheduled reminder whose window contains `now`, or null. */
export function dueScheduledKind(now: Date): ScheduledKind | null {
  if (now.getTime() > eventEnd().getTime()) return null;
  let due: ScheduledKind | null = null;
  for (const kind of SCHEDULED_KINDS) {
    if (sendAt(kind).getTime() <= now.getTime()) due = kind;
  }
  return due;
}

/** Captain nudge runs in the final week (from −7d) until the event starts. */
export function captainNudgeDue(now: Date): boolean {
  return (
    now.getTime() >= sendAt("reminder_7d").getTime() && now.getTime() < eventStart().getTime()
  );
}

/** All lifecycle kinds due at `now` (scheduled reminder + optional captain nudge). */
export function dueKinds(now: Date): LifecycleKind[] {
  const kinds: LifecycleKind[] = [];
  const scheduled = dueScheduledKind(now);
  if (scheduled) kinds.push(scheduled);
  if (captainNudgeDue(now)) kinds.push("captain_incomplete");
  return kinds;
}

export type ScheduleRow = {
  kind: ScheduledKind;
  sendAt: Date;
  status: "done" | "due" | "upcoming";
};

/** For the admin UI: each scheduled kind with its send time + status vs now. */
export function scheduleRows(now: Date): ScheduleRow[] {
  const due = dueScheduledKind(now);
  return SCHEDULED_KINDS.map((kind) => {
    const at = sendAt(kind);
    const status: ScheduleRow["status"] =
      kind === due ? "due" : at.getTime() <= now.getTime() ? "done" : "upcoming";
    return { kind, sendAt: at, status };
  });
}
