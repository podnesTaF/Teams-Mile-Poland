import { z } from "zod";

import { instantToWarsawLocal } from "@/lib/events/heat-time";
import { firstHeatTime } from "@/lib/events/timetables";
import type { EventStatus, EventType, TimeRange } from "@/lib/events/types";

import { isEventDate } from "./event-slug";

/**
 * The pure half of the event admin writes: what a valid event form says, which
 * lifecycle moves are legal, and which already-generated heats an edited window
 * has left behind.
 *
 * Split out of `event-actions.ts` for two reasons, and the second is the real
 * one. `"use server"` files may only export async functions, so a transition
 * *table* cannot live next to the action that enforces it — and the settings
 * page has to render the legal next states as buttons, which means the table
 * must be importable by a page as data. Keeping the rule in one place is what
 * stops the UI offering a move the action then refuses.
 *
 * Nothing here reads the database or the session; every function is a pure
 * function of what it was given, so the whole rule set is testable without a
 * `DATABASE_URL` — the same seam `eventSlugForDate` and `FlashContext` take.
 */

/* ── the lifecycle ──────────────────────────────────────────────────── */

/**
 * Which statuses an event may move to from each status it can be in.
 *
 * A `Record<EventStatus, …>`, not a list of pairs and not a chain of `if`s,
 * because the type makes it **total**: adding a seventh lifecycle state is a
 * compile error here until someone decides what it can become. That is the same
 * exhaustiveness net the status badge and the roster copy maps rely on, and the
 * reason `EventStatus` is a TS union over a `text` column rather than a pg enum
 * (see `db/schema/events.ts`).
 *
 * The rules encoded, each one a decision rather than a shape:
 *
 * - **Forward only, one step at a time** along `draft → upcoming →
 *   registration_open → registration_closed → completed`. Skipping a step would
 *   let an event go from unannounced straight to accepting entries, which is
 *   exactly the "one click announced a race" accident the draft state exists to
 *   prevent.
 * - **`cancelled` from anywhere except `completed`.** A race that has been run
 *   cannot be un-run; rewriting a finished night is not a state change, and its
 *   results and gallery are already public.
 * - **Two reopen paths**, `registration_closed → registration_open` and
 *   `cancelled → upcoming`, because closing entries and calling a night off are
 *   both single clicks, and a single-click mistake has to be undoable in a
 *   single click. Note what they are *not*: general backward movement. There is
 *   no `upcoming → draft` (the announcement has already been made — un-listing
 *   it does not un-send it) and no `completed → anything`.
 * - **No self-transition.** Pressing "open registration" on an event that is
 *   already open is a stale tab, not a no-op worth confirming, so it is refused
 *   like any other illegal move — the refusal names the same status twice, which
 *   is precisely the information the admin is missing.
 */
export const EVENT_TRANSITIONS: Record<EventStatus, readonly EventStatus[]> = {
  draft: ["upcoming", "cancelled"],
  upcoming: ["registration_open", "cancelled"],
  registration_open: ["registration_closed", "cancelled"],
  registration_closed: ["registration_open", "completed", "cancelled"],
  completed: [],
  cancelled: ["upcoming"],
};

/** Whether `to` is a legal next status from `from` — see {@link EVENT_TRANSITIONS}. */
export function canTransition(from: EventStatus, to: EventStatus): boolean {
  return EVENT_TRANSITIONS[from].includes(to);
}

/**
 * The statuses the settings page should offer as buttons for an event currently
 * in `from`. Reads the same table the action enforces, so the control cannot
 * offer a move that is about to be refused.
 */
export function nextStatuses(from: EventStatus): readonly EventStatus[] {
  return EVENT_TRANSITIONS[from];
}

/** Every lifecycle status, for narrowing a submitted `?status=` form value. */
const EVENT_STATUSES = Object.keys(EVENT_TRANSITIONS) as EventStatus[];

/**
 * Whether a submitted value names a lifecycle status.
 *
 * The status arrives as form input, so it is someone's string until this says
 * otherwise — and it must be narrowed *before* it is used as a
 * `Record<EventStatus, …>` key, or a crafted post indexes the transition table
 * with a value that is not in it and reads `undefined`.
 */
export function isEventStatus(value: unknown): value is EventStatus {
  return typeof value === "string" && (EVENT_STATUSES as string[]).includes(value);
}

/* ── the form ───────────────────────────────────────────────────────── */

/**
 * Upper bound on the bib pool. Not a domain rule — the timing system supplies 50
 * (ADR 0003) and no night has wanted more — but a bound is what turns a fat-
 * fingered `500000` into a flash the admin can act on instead of an int4
 * overflow from the driver.
 */
const MAX_BIB_POOL = 5000;

/** Upper bound on heat spacing: heats a day apart are not one race night. */
const MAX_HEAT_INTERVAL_MINUTES = 24 * 60;

/** `HH:MM` on a 24-hour clock — the shape both window fields are stored in. */
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * The fields an event's create and edit forms share, minus the window.
 *
 * The window is validated separately ({@link eventWindowSchema}) rather than as
 * two more keys here, because the two failures are reported to the admin by
 * *different* flash codes: a missing name is the generic `input` refusal, a
 * back-to-front window is `invalid_window`, which says what a window is. One
 * schema would collapse them into one `safeParse` failure and leave the action
 * digging through `error.issues` for a path name to tell them apart.
 *
 * The date is checked with {@link isEventDate} rather than a regex, so
 * `2026-02-31` is refused here rather than becoming a permanent slug: on create
 * this exact string is what `generateEventSlug` turns into the row's primary
 * key, and the six tables that join on it have no foreign key to catch a bad
 * one. The same check runs on edit even though the slug no longer follows the
 * date — an impossible date is not more acceptable in the column that every
 * public surface renders.
 */
export const eventFieldsSchema = z.object({
  name: z.string().trim().min(1, "A name is required").max(120),
  date: z.string().trim().refine(isEventDate, "Enter the date as YYYY-MM-DD"),
  venue: z.string().trim().min(1, "A venue is required").max(160),
  city: z.string().trim().min(1, "A city is required").max(120),
  bibPool: z.coerce.number().int().min(1).max(MAX_BIB_POOL),
  heatIntervalMinutes: z.coerce.number().int().min(1).max(MAX_HEAT_INTERVAL_MINUTES),
});

export type EventFields = z.infer<typeof eventFieldsSchema>;

/**
 * The event's wall-clock window. Both times are `HH:MM` and the start must come
 * strictly before the end — `09:15–09:15` is not a race night, and the public
 * timetable is *generated* from the start (`buildMileTimetable`), so an inverted
 * window would render five spans running backwards.
 *
 * Compared as strings on purpose: zero-padded 24-hour times sort
 * lexicographically, so this needs no parsing and no timezone. The window is
 * wall clock at the stadium and is never converted to an instant here — that
 * conversion belongs to heat times, which are stored instants.
 */
export const eventWindowSchema = z
  .object({
    startTime: z.string().trim().regex(HHMM, "Enter the start as HH:MM"),
    endTime: z.string().trim().regex(HHMM, "Enter the end as HH:MM"),
  })
  .refine((w) => w.startTime < w.endTime, {
    message: "The start must be before the end",
    path: ["endTime"],
  });

export type EventWindow = z.infer<typeof eventWindowSchema>;

/**
 * The two event formats. `individual` is the Aug-2026 mile series and the only
 * one with a registration flow; `team` is the legacy TEAMS MILE stack, which the
 * create form may select but which has no entry path — stated plainly in the
 * form rather than offered as a trap.
 *
 * Create-only. A slug's family, its registrations, its heats and its results all
 * assume one format, so the type is as immutable as the slug: `updateEvent` does
 * not read this field.
 */
const EVENT_TYPES = ["individual", "team"] as const satisfies readonly EventType[];

export const eventTypeSchema = z.enum(EVENT_TYPES);

/**
 * Whether an event with this window may be saved without one.
 *
 * Only `individual` events require a window: the timetable, the heat-time
 * prefill and the public event page all derive from the start time, so an
 * individual night without one is a page with no schedule. The legacy team event
 * has no window at all (`start_time` / `end_time` are nullable for exactly that
 * row), so a blank window is valid there and stores as null.
 */
export function windowRequired(eventType: EventType): boolean {
  return eventType === "individual";
}

/* ── date in the past ───────────────────────────────────────────────── */

/**
 * Whether `date` (a `YYYY-MM-DD`) is before today **in Warsaw**.
 *
 * Warsaw, not UTC and not the server's zone: the date is a calendar day at a
 * stadium in Warsaw, so "is that in the past" is a question about the clock on
 * the wall there. Reuses the same per-instant offset resolution heat times use,
 * rather than a second opinion about what day it is — during the two hours after
 * midnight CEST a UTC reading would still say yesterday and flag a perfectly
 * ordinary same-day back-fill.
 *
 * A past date is **allowed** — back-filling a night that already ran is a real
 * admin task — so this only decides whether the confirmation carries the
 * `?past=1` caveat. It is worth carrying: a past date is also what a typo looks
 * like, and it permanently names the slug. It says nothing about mail; a
 * back-filled event is never due for any scheduled kind (`dueScheduledKind`
 * returns null once the window has passed), which is why the caveat's wording is
 * about the slug and the public page.
 */
export function isPastEventDate(date: string, now: Date = new Date()): boolean {
  return date < instantToWarsawLocal(now).slice(0, 10);
}

/* ── heats an edited window has stranded ────────────────────────────── */

/** The shape {@link heatsOutsideWindow} needs of a heat — `HeatWithFill` satisfies it. */
export type ScheduledHeat = { number: number; scheduledAt: Date };

/** The shape it needs of an event: the saved day and the saved window. */
export type WindowedEvent = { date: string; timeRange?: TimeRange };

/**
 * The numbers of the generated heats that no longer sit inside the event's
 * window, lowest first.
 *
 * **Editing an event never moves a heat.** A heat's `scheduledAt` is a stored
 * instant written from the generator form's own fields, and nothing anywhere
 * recomputes it from the event — so narrowing a window or moving a date leaves
 * every existing heat exactly where it was. That is the right behaviour (an
 * admin mid-reschedule may move the date first and re-time the card second), and
 * it is why this function *counts* rather than refuses.
 *
 * A heat is outside the window when, read as Warsaw wall-clock, either:
 *
 * - its **date differs from the event's date** — the dominant case, and the one
 *   that actually costs something: a date move strands the whole card on a day
 *   nobody will be at the stadium; or
 * - its **time falls outside `[firstHeatTime(start), end]`** — the tail case a
 *   narrowed window produces, usually one or two heats.
 *
 * The lower bound is `firstHeatTime(start)`, i.e. the window's start plus the
 * hour of check-in and briefing, **not** the start itself: that is already what
 * the generator prefills the first heat from, so the warning and the prefill
 * agree about when racing begins. The upper bound is the window's own `end`
 * rather than the timetable's nominal racing block, so a card that deliberately
 * runs into the cooldown slot does not trip a false warning.
 *
 * Events with no window (the legacy team event) are out of scope and return
 * nothing — they have no heats, and the Heats tab 404s for them.
 *
 * Returns heat numbers rather than a count, mirroring `outOfOrderHeats`, so the
 * Heats tab can name the heats while the post-save flash counts them. Its
 * natural home is beside that twin in `heats-data.ts`; it lives here because
 * that file belongs to another slice, and because everything it needs is pure.
 */
export function heatsOutsideWindow(
  heats: readonly ScheduledHeat[],
  event: WindowedEvent,
): number[] {
  const range = event.timeRange;
  if (!range) return [];
  const earliest = firstHeatTime(range.start);
  const outside: number[] = [];
  for (const heat of heats) {
    const local = instantToWarsawLocal(heat.scheduledAt);
    const day = local.slice(0, 10);
    const time = local.slice(11, 16);
    if (day !== event.date || time < earliest || time > range.end) outside.push(heat.number);
  }
  return outside.sort((a, b) => a - b);
}
