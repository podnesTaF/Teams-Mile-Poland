import { computeLevel } from "./levels";
import { nameKey } from "./name-key";
import type { EventSummary, ResultEntry, EventResults } from "./types";

/**
 * One event a user took part in, as the DB knows it. Result sheets carry only a
 * free-text name — never a user id — so a user's results are recovered by
 * matching within exactly the events they are recorded as participating in
 * (event_registrations or legacy_participations). Imported results
 * (`event_results`) may additionally carry a registration link resolved from
 * the (heat, bib) lease at import time; the caller passes those in as direct
 * refs, which outrank name matching.
 */
export type ParticipationRef = {
  eventSlug: string;
  /** Bib lease from the registration, when one was issued — tie-breaker only. */
  bib?: number | null;
};

export type UserResultMatch = {
  event: EventSummary;
  /** Heat the result was recorded in (config heat number, 1-based). */
  heatNumber: number;
  entry: ResultEntry;
  /** 1-based place across all heats of the event, by net time. */
  rank: number;
  /** Finishers across all heats of the event. */
  total: number;
  /** AB-mile rating level for the time (1 = top, 16 = entry). */
  level: number;
};

/**
 * A user's results across their participations, newest event first.
 *
 * `resultsBySlug` is the merged DB-first/config view the caller loaded (see
 * `results-data.ts`); this function stays pure. Per event, the entry is chosen
 * by, in order:
 *
 * 1. a **direct ref** — the imported row linked to the user's registration at
 *    import time, located by its (heat, bib) identity;
 * 2. a normalized-name match within that event's sheet — a same-named stranger
 *    who never registered can't pick up a result. When one sheet holds several
 *    entries with the same name, the registration's bib may disambiguate;
 *    otherwise the event is skipped rather than guessed, the same rule the
 *    legacy import enforced.
 */
export function findUserResults(
  fullName: string,
  participations: ParticipationRef[],
  resultsBySlug: Map<string, EventResults>,
  directRefs: Map<string, { heatNumber: number; bib: number }> = new Map(),
  /**
   * The events those participations point at, resolved by the caller. Passed in
   * rather than looked up because resolving an event is a database read now
   * (`getEventBySlug` is async): keeping this matcher synchronous and pure is
   * what stops the profile page and the admin user-detail page from drifting
   * into reporting different results for the same person — the guarantee
   * `getUserDetail`'s docblock already promises. Required, not defaulted: a
   * silently empty map would make every match vanish. Three callers pass it —
   * the profile page, the admin user-detail page, and
   * `scripts/verify-results-import.ts`.
   */
  eventsBySlug: Map<string, EventSummary>,
): UserResultMatch[] {
  const key = nameKey(fullName);

  // One entry per event; a bib from any duplicate participation row wins.
  const bibBySlug = new Map<string, number | null>();
  for (const p of participations) {
    if (!bibBySlug.has(p.eventSlug) || bibBySlug.get(p.eventSlug) == null) {
      bibBySlug.set(p.eventSlug, p.bib ?? null);
    }
  }

  const matches: UserResultMatch[] = [];
  for (const [slug, bib] of bibBySlug) {
    const event = eventsBySlug.get(slug);
    const results = resultsBySlug.get(slug);
    if (!event || !results) continue;

    const field = results.heats
      .flatMap((heat) => heat.entries.map((entry) => ({ heatNumber: heat.number, entry })))
      .sort((a, b) => a.entry.timeCs - b.entry.timeCs);

    const direct = directRefs.get(slug);
    let chosen = direct
      ? field.find((row) => row.heatNumber === direct.heatNumber && row.entry.bib === direct.bib)
      : undefined;

    if (!chosen && key) {
      const candidates = field.filter((row) => nameKey(row.entry.name) === key);
      if (candidates.length === 1) chosen = candidates[0];
      if (!chosen && candidates.length > 1 && bib != null) {
        const byBib = candidates.filter((row) => row.entry.bib === bib);
        if (byBib.length === 1) chosen = byBib[0];
      }
    }
    if (!chosen) continue;

    matches.push({
      event,
      heatNumber: chosen.heatNumber,
      entry: chosen.entry,
      rank: field.indexOf(chosen) + 1,
      total: field.length,
      level: computeLevel(chosen.entry.timeCs, chosen.entry.gender),
    });
  }

  return matches.sort((a, b) => (a.event.date < b.event.date ? 1 : -1));
}
