import { computeLevel } from "./levels";
import { nameKey } from "./name-key";
import { getEventBySlug } from "./registry";
import type { EventSummary, ResultEntry } from "./types";

/**
 * One event a user took part in, as the DB knows it. Results themselves are
 * config (see `results/`), carry only a free-text name, and never reference a
 * user id — so a user's results are recovered at read time by matching their
 * profile name against the result sheets of exactly the events they are
 * recorded as participating in (event_registrations or legacy_participations).
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
 * Matching is by normalized name within a single event's sheet, scoped to
 * events the user actually participated in — a same-named stranger who never
 * registered can't pick up a result. When one sheet holds several entries
 * with the same name, the registration's bib may disambiguate; otherwise the
 * event is skipped rather than guessed, the same rule the legacy import
 * enforced.
 */
export function findUserResults(
  fullName: string,
  participations: ParticipationRef[],
): UserResultMatch[] {
  const key = nameKey(fullName);
  if (!key) return [];

  // One entry per event; a bib from any duplicate participation row wins.
  const bibBySlug = new Map<string, number | null>();
  for (const p of participations) {
    if (!bibBySlug.has(p.eventSlug) || bibBySlug.get(p.eventSlug) == null) {
      bibBySlug.set(p.eventSlug, p.bib ?? null);
    }
  }

  const matches: UserResultMatch[] = [];
  for (const [slug, bib] of bibBySlug) {
    const event = getEventBySlug(slug);
    if (!event?.results) continue;

    const field = event.results.heats
      .flatMap((heat) => heat.entries.map((entry) => ({ heatNumber: heat.number, entry })))
      .sort((a, b) => a.entry.timeCs - b.entry.timeCs);

    const candidates = field.filter((row) => nameKey(row.entry.name) === key);
    let chosen = candidates.length === 1 ? candidates[0] : undefined;
    if (!chosen && candidates.length > 1 && bib != null) {
      const byBib = candidates.filter((row) => row.entry.bib === bib);
      if (byBib.length === 1) chosen = byBib[0];
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
