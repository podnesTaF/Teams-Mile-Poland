import { cache } from "react";
import { asc } from "drizzle-orm";

import { events, type EventRow } from "@/db/schema";
import { db } from "@/lib/db";

import { RESULTS_SHEETS } from "./results-sheets";
import { buildMileTimetable, firstHeatTime } from "./timetables";
import {
  DEFAULT_BIB_POOL,
  DEFAULT_HEAT_INTERVAL_MINUTES,
  type EventSummary,
  type TimeRange,
} from "./types";

/**
 * The DB-backed event reader — which events exist and what state each is in.
 * Successor of the `EVENTS` literal that `registry.ts` used to export: the
 * lifecycle is an admin action now, not a code edit plus a deploy.
 *
 * **One query per request, not one per selector.** There are a handful of
 * events, every selector is a filter over the same list, and the selectors have
 * always shared a single snapshot — `getFeaturedEvent`'s open-first preference
 * only means anything if it is looking at the same set `getSeriesEvents` is. So
 * {@link loadEvents} reads the whole table once, request-cached with React
 * `cache`, and each selector filters in memory exactly as it filtered the
 * literal before. Per-selector queries would be both slower and less correct.
 *
 * Deliberately forgiving, like `media-config.ts` and `results-data.ts`: the
 * landing, the event pages and their metadata must all build when the database
 * is missing (local/preview) or briefly unreachable, so a failed read degrades
 * to "no events" rather than taking the build down. Admin mutations are where
 * failures are loud.
 *
 * That forgiveness has one sharp edge worth a warning of its own — an empty list
 * renders a site with no featured event and no event pages, which looks
 * *intentional* rather than broken. So an empty read says so out loud; see
 * {@link warnIfEmpty}.
 *
 * This module also owns the **one** definition of what the public site may show:
 * {@link isPubliclyVisible}. Public pages ask it rather than re-testing statuses
 * inline, so "a draft 404s, a cancelled night does not" is stated once.
 */

/** Turn `"2026-08-01"` into the locale-independent `"01 · 08 · 2026"`. */
function shortDate(date: string): string {
  const [y, m, d] = date.split("-");
  return `${d} · ${m} · ${y}`;
}

/**
 * Map a row to the `EventSummary` the whole site already reads.
 *
 * Everything derived is derived here, so the table stores facts and nothing
 * else: `shortDate` from the date, `timeRange` from the stored window, and the
 * on-site `timetable` from the window's start — every night in the series runs
 * the same three-hour flow, so the schedule follows from the start time and is
 * not a stored (or editable) field.
 */
function toSummary(row: EventRow): EventSummary {
  const timeRange: TimeRange | undefined =
    row.startTime && row.endTime ? { start: row.startTime, end: row.endTime } : undefined;
  return {
    slug: row.slug,
    status: row.status,
    eventType: row.eventType,
    name: row.name,
    date: row.date,
    shortDate: shortDate(row.date),
    venue: row.venue,
    city: row.city,
    ...(timeRange ? { timeRange } : {}),
    ...(timeRange && row.eventType === "individual"
      ? { timetable: buildMileTimetable(timeRange.start) }
      : {}),
    bibPool: row.bibPool,
    heatIntervalMinutes: row.heatIntervalMinutes,
    ...(RESULTS_SHEETS[row.slug] ? { results: RESULTS_SHEETS[row.slug] } : {}),
  };
}

/**
 * Say it loudly when there are no events at all.
 *
 * A build run without `DATABASE_URL` produces a site with zero event pages and
 * no featured event, and every individual surface degrades politely enough that
 * nothing looks wrong. This is the one line that distinguishes "the series has
 * not been announced yet" from "the build could not see the database".
 */
function warnIfEmpty(list: EventSummary[]): EventSummary[] {
  if (list.length === 0) {
    console.warn(
      "[events] no event rows — the site will render with no featured event and no event pages. " +
        "If this is a build, DATABASE_URL is probably unset.",
    );
  }
  return list;
}

/**
 * Every event, soonest first. The shared snapshot each selector below filters.
 *
 * Ordered in SQL so the order is stable regardless of insertion sequence; the
 * selectors still sort explicitly, because several of them want the other
 * direction.
 */
const loadEvents = cache(async (): Promise<EventSummary[]> => {
  if (!db) {
    console.error("[events] no database configured; treating the event list as empty");
    return warnIfEmpty([]);
  }
  try {
    const rows = await db.select().from(events).orderBy(asc(events.date));
    return warnIfEmpty(rows.map(toSummary));
  } catch (error) {
    console.error("[events] events read failed; treating the event list as empty:", error);
    return warnIfEmpty([]);
  }
});

/**
 * Whether an event has a public surface at all.
 *
 * Exactly one status hides an event from the public site: `draft`. A draft is a
 * night that has been created but not announced, so every public surface 404s on
 * its slug — for a signed-in admin too, because one surface tells one truth and
 * the admin's view of a draft is the admin area, not the live page.
 *
 * `cancelled` is deliberately **visible**. The night is off, but it happened as
 * an announcement: its link was mailed, posted and bookmarked, and people who
 * signed up need the page to tell them it is cancelled. That is the whole reason
 * the status exists — the 2026-08-08 night had to be deleted from the registry
 * outright for want of it (see `registry.ts`). A cancelled event is therefore
 * excluded from every list that *promotes* a night (the featured pick, the
 * landing's series cards, the mailing runs) while its detail page keeps
 * rendering, with a cancelled banner and no register CTA.
 *
 * Stays synchronous, exactly like {@link isRegistrationOpen}: it is a question
 * about an event you already hold, not a read.
 */
export function isPubliclyVisible(event: EventSummary): boolean {
  return event.status !== "draft";
}

/**
 * Whether an event is a night the site should still be promoting: publicly
 * visible ({@link isPubliclyVisible}), not called off, not yet run.
 *
 * The shared predicate behind {@link getFeaturedEvent} and
 * {@link getSeriesEvents} — the featured pick and the landing's series cards
 * answer the same question ("which nights can someone still come to?") and must
 * not drift apart.
 */
function isForthcoming(event: EventSummary): boolean {
  return isPubliclyVisible(event) && event.status !== "cancelled" && event.status !== "completed";
}

/**
 * The "next" event the site should promote: the soonest event still accepting
 * registrations, falling back to the soonest not-yet-completed event when none
 * is open. The open-first preference matters once a race night's registration
 * closes — by date that night is still the soonest non-completed event, and
 * featuring it would strip the landing's register CTA (see
 * {@link isRegistrationOpen}) while a later night is taking entries. Returns
 * `null` when nothing is scheduled.
 *
 * Drafts and cancelled nights are never featured: promoting one would announce
 * an unannounced night, or send the landing's whole hero at a race that is off.
 */
export async function getFeaturedEvent(): Promise<EventSummary | null> {
  const all = await loadEvents();
  const scheduled = all.filter(isForthcoming).sort((a, b) => a.date.localeCompare(b.date));
  return scheduled.find((e) => e.status === "registration_open") ?? scheduled[0] ?? null;
}

/**
 * Completed events, newest first.
 *
 * Nothing to exclude here beyond the status test itself: `completed` is one
 * status, so a `draft` or `cancelled` night can never appear in this list. A
 * cancelled night is not "past" — it never ran, and has no results to show.
 */
export async function getPastEvents(): Promise<EventSummary[]> {
  const all = await loadEvents();
  return all.filter((e) => e.status === "completed").sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Completed events that have results, newest first. Inherits
 * {@link getPastEvents}' `completed`-only filter, so drafts and cancelled nights
 * cannot reach it.
 */
export async function getResultsEvents(): Promise<EventSummary[]> {
  const past = await getPastEvents();
  return past.filter((e) => e.results);
}

/**
 * Whether the featured event is currently accepting registrations.
 *
 * Stays synchronous: it is a question about an event you already hold, not a
 * read, and making it async would push an `await` into every caller for nothing.
 */
export function isRegistrationOpen(event: EventSummary | null): boolean {
  return event?.status === "registration_open";
}

/**
 * Events accepting registrations now, soonest first. `registration_open` is a
 * single status, so this already excludes `draft` and `cancelled` — a draft has
 * to be announced before it can open, and cancelling an open night moves it out
 * of this list by moving its status.
 */
export async function getOpenEvents(): Promise<EventSummary[]> {
  const all = await loadEvents();
  return all
    .filter((e) => e.status === "registration_open")
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Announced-but-not-yet-open events, soonest first. Same story as
 * {@link getOpenEvents}: `upcoming` is one status, and it is the status a night
 * reaches by *being announced*, so a draft is excluded by definition.
 */
export async function getUpcomingEvents(): Promise<EventSummary[]> {
  const all = await loadEvents();
  return all.filter((e) => e.status === "upcoming").sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * The individual mile series as the public site sees it, soonest first — every
 * individual night someone can still come to, regardless of open/upcoming state.
 * Drives the landing cards section.
 *
 * Excludes `draft` and `cancelled` (see {@link isForthcoming}), and that
 * exclusion is load-bearing well beyond the landing: this is also the event list
 * the reminder cron iterates (`event-mailings/dispatch.ts`), the admin mailings
 * overview, the profile's "other nights you could enter", and the admin
 * register-for-a-user dropdown. All of them want the same set, which is why the
 * filter lives here and not in any one caller.
 */
export async function getSeriesEvents(): Promise<EventSummary[]> {
  const all = await loadEvents();
  return all
    .filter((e) => e.eventType === "individual" && isForthcoming(e))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Every individual mile event regardless of lifecycle status. Two consumers: the
 * "Aug events" universe the broadcast segments (`registered_any_aug`,
 * `not_registered_aug`, `registered:<slug>`, `awaiting_confirmation:<slug>`,
 * `confirmed:<slug>`) are computed against, and the event detail page's static
 * params (a completed race night must keep its page — the gallery teaser/back-
 * link and media-live mailing CTA point at it). Unlike {@link getSeriesEvents}
 * this includes completed individual events, so a past event stays reachable.
 * Soonest first.
 *
 * **Unfiltered on purpose, including drafts.** The admin nav and the segment
 * universe have to see a night that has not been announced yet. The one public
 * consumer — `events/[slug]`'s `generateStaticParams` — applies
 * {@link isPubliclyVisible} itself, so no draft path is prerendered; adding the
 * filter here instead would blind the admin.
 */
export async function getIndividualEvents(): Promise<EventSummary[]> {
  const all = await loadEvents();
  return all
    .filter((e) => e.eventType === "individual")
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Look up a single event by slug. */
export async function getEventBySlug(slug: string): Promise<EventSummary | undefined> {
  const all = await loadEvents();
  return all.find((e) => e.slug === slug);
}

/**
 * The bib pool an event draws leases from (ADR 0003), falling back to the series
 * default for an event the store does not know. The column is `not null` with
 * the same default, so the fallback now only covers an unknown slug.
 */
export async function getBibPool(slug: string): Promise<number> {
  const event = await getEventBySlug(slug);
  return event?.bibPool ?? DEFAULT_BIB_POOL;
}

/**
 * Spacing used to prefill generated heat start times, falling back to the series
 * default. Once a heat is generated its `scheduledAt` is a stored fact and
 * editing the event never moves it — this only shapes the *next* generation.
 */
export async function getHeatIntervalMinutes(slug: string): Promise<number> {
  const event = await getEventBySlug(slug);
  return event?.heatIntervalMinutes ?? DEFAULT_HEAT_INTERVAL_MINUTES;
}

/**
 * Wall-clock time ("HH:MM") the first heat of an event can start — the moment its
 * racing window opens. `null` for events with no configured window.
 */
export async function getFirstHeatTime(slug: string): Promise<string | null> {
  const event = await getEventBySlug(slug);
  const start = event?.timeRange?.start;
  return start ? firstHeatTime(start) : null;
}

/** Look up a single event by slug, throwing if it does not exist. */
export async function getEventOrThrow(slug: string): Promise<EventSummary> {
  const event = await getEventBySlug(slug);
  if (!event) {
    throw new Error(`Unknown event slug: ${slug}`);
  }
  return event;
}
