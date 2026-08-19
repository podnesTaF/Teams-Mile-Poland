import { computeLevel } from "./levels";
import { nameKey } from "./name-key";
import type { Gender, ResultEntry } from "./types";

/**
 * Person-level leaderboard: one row per runner across the whole series, ranked
 * by their best mile time.
 *
 * The landing's per-event tables rank **result rows** — a runner who ran three
 * nights shows up three times. This module folds those rows into people, which
 * is what a series standings board means: best time, the race it was set at,
 * the AB-mile level it earns, and how many races the runner has finished.
 *
 * Ranking is best-time only (v1) — deliberately *not* a points-per-race season
 * system, which is a client decision and would change what "leader" means.
 *
 * Kept UI-free (no React, no i18n) on purpose: the landing renders it today,
 * and the admin user detail / public profile pages are the next callers.
 */

/**
 * A finisher row as the leaderboard reads it. The two identity fields are
 * optional because most sources have neither: config result sheets carry only a
 * hand-entered name, and the public landing never loads registrations. Callers
 * that *do* know the link (imported `event_results.registration_id`, resolved
 * to its account) pass it in and get exact identity instead of name matching.
 */
export type LeaderboardEntry = ResultEntry & {
  /** Registration the import linked this row to, when known. */
  registrationId?: string | null;
  /** Account behind that registration, when the caller resolved it. */
  userId?: string | null;
};

/** The slice of an event the leaderboard needs — `EventSummary` satisfies it. */
export type LeaderboardEvent = {
  slug: string;
  /** ISO date, YYYY-MM-DD — orders races and breaks best-time ties. */
  date: string;
  /** Locale-independent display date, e.g. "01 · 08 · 2026". */
  shortDate: string;
  results?: { heats: { number: number; entries: LeaderboardEntry[] }[] } | null;
};

/** One runner's standing in the series. */
export type LeaderboardPerson = {
  /** Identity key rows were grouped by — stable React key, opaque otherwise. */
  key: string;
  /** 1-based standing by best time (ties keep consecutive places, as the
   * per-event tables do). */
  rank: number;
  /** Name as written on the best-time row. */
  name: string;
  gender: Gender;
  /** Best (lowest) net time across every race, in hundredths of a second. */
  bestTimeCs: number;
  /** AB-mile level of the best time (gender-aware — see `computeLevel`). */
  level: number;
  /** Races finished: distinct events with at least one finisher row. */
  races: number;
  /** The race the best time was set at. */
  bestEvent: { slug: string; date: string; shortDate: string };
  /** Heat and bib of the best-time row — the row's identity within its event. */
  bestHeatNumber: number;
  bestBib: number;
};

/**
 * How rows are grouped into people, best key first:
 *
 * 1. `userId` — the only key that can merge across events, since a
 *    registration belongs to exactly one event. Callers resolve it from the
 *    imported row's `registration_id`.
 * 2. `registrationId` — merges the several rows one entry can produce in a
 *    single night (a qualification and a final), without claiming to know the
 *    account behind it.
 * 3. `nameKey(name)` + gender — the fallback that carries every legacy and
 *    config-sheet row, matching exactly how `findUserResults` pairs a profile
 *    with a sheet. Gender joins the key because it decides the level bars, so
 *    two same-named runners of different genders stay apart.
 *
 * A row whose name normalizes to nothing (no letters at all) gets a key unique
 * to that row: unidentifiable is not the same as absent, and dropping it would
 * quietly shrink the field.
 */
function identityKey(entry: LeaderboardEntry, eventSlug: string, heatNumber: number): string {
  if (entry.userId) return `user:${entry.userId}`;
  if (entry.registrationId) return `reg:${entry.registrationId}`;
  const key = nameKey(entry.name);
  if (key) return `name:${key}|${entry.gender}`;
  return `row:${eventSlug}:${heatNumber}:${entry.bib}`;
}

/** Every finisher row of every given event, flattened with its event. */
function flatten(events: LeaderboardEvent[]) {
  return events.flatMap((event) =>
    (event.results?.heats ?? []).flatMap((heat) =>
      heat.entries.map((entry) => ({ event, heatNumber: heat.number, entry })),
    ),
  );
}

/**
 * The series standings for the given events, fastest first.
 *
 * Per person the best time wins; equal times inside one person resolve to the
 * earlier race, then the lower heat — so the row a runner is credited with
 * never depends on input order. Across people, equal best times are ordered by
 * whoever set the mark first, then by name, keeping the board (and the
 * prerendered HTML) identical on every build.
 *
 * Events without results, and events not yet completed, are simply absent from
 * the input — the caller decides what counts (see `getResultsEventsWithDb`).
 */
export function buildLeaderboard(events: LeaderboardEvent[]): LeaderboardPerson[] {
  type Draft = {
    key: string;
    name: string;
    gender: Gender;
    bestTimeCs: number;
    bestEvent: LeaderboardEvent;
    bestHeatNumber: number;
    bestBib: number;
    eventSlugs: Set<string>;
  };

  const drafts = new Map<string, Draft>();
  for (const { event, heatNumber, entry } of flatten(events)) {
    const key = identityKey(entry, event.slug, heatNumber);
    const draft = drafts.get(key);
    if (!draft) {
      drafts.set(key, {
        key,
        name: entry.name,
        gender: entry.gender,
        bestTimeCs: entry.timeCs,
        bestEvent: event,
        bestHeatNumber: heatNumber,
        bestBib: entry.bib,
        eventSlugs: new Set([event.slug]),
      });
      continue;
    }
    draft.eventSlugs.add(event.slug);
    const better =
      entry.timeCs < draft.bestTimeCs ||
      (entry.timeCs === draft.bestTimeCs &&
        (event.date < draft.bestEvent.date ||
          (event.date === draft.bestEvent.date && heatNumber < draft.bestHeatNumber)));
    if (better) {
      // The best row also supplies the display name and gender: it is the
      // result being ranked, so its spelling is the one that earned the place.
      draft.name = entry.name;
      draft.gender = entry.gender;
      draft.bestTimeCs = entry.timeCs;
      draft.bestEvent = event;
      draft.bestHeatNumber = heatNumber;
      draft.bestBib = entry.bib;
    }
  }

  return [...drafts.values()]
    .sort(
      (a, b) =>
        a.bestTimeCs - b.bestTimeCs ||
        (a.bestEvent.date < b.bestEvent.date ? -1 : a.bestEvent.date > b.bestEvent.date ? 1 : 0) ||
        a.name.localeCompare(b.name, "en") ||
        a.key.localeCompare(b.key, "en"),
    )
    .map((draft, i) => ({
      key: draft.key,
      rank: i + 1,
      name: draft.name,
      gender: draft.gender,
      bestTimeCs: draft.bestTimeCs,
      level: computeLevel(draft.bestTimeCs, draft.gender),
      races: draft.eventSlugs.size,
      bestEvent: {
        slug: draft.bestEvent.slug,
        date: draft.bestEvent.date,
        shortDate: draft.bestEvent.shortDate,
      },
      bestHeatNumber: draft.bestHeatNumber,
      bestBib: draft.bestBib,
    }));
}

/**
 * The key a person known only by name and gender would be grouped under —
 * how a profile or admin page locates its own runner in the board without
 * re-implementing the identity rules. Empty when the name normalizes to
 * nothing, which no board row can match.
 */
export function leaderboardNameKey(name: string, gender: Gender): string {
  const key = nameKey(name);
  return key ? `name:${key}|${gender}` : "";
}
