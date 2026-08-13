import { asc, inArray } from "drizzle-orm";

import { eventResults } from "@/db/schema";
import { db } from "@/lib/db";
import { getEventBySlug, getPastEvents } from "./registry";
import type { EventResults, EventSummary, ResultHeat } from "./types";

/**
 * Results, DB-first: rows imported from the timing system (`event_results`)
 * take precedence; events never imported fall back to their hand-entered
 * config sheet (`results/*.ts` on the registry entry). Once every event with a
 * config sheet is backfilled into the table, the fallback — and the sheets —
 * can go.
 *
 * Public readers see finishers only, same as the config model: DNF/DNS/DSQ are
 * stored but have no public representation yet.
 *
 * Deliberately forgiving: the landing must render when the database is missing
 * (local/preview) or briefly unreachable, so a failed read degrades to the
 * config sheets rather than taking the page down.
 */

/** DB rows for the given events, grouped into the config `EventResults` shape. */
async function readDbResults(slugs: string[]): Promise<Map<string, EventResults>> {
  const grouped = new Map<string, EventResults>();
  if (!db || slugs.length === 0) return grouped;

  const rows = await db
    .select({
      eventSlug: eventResults.eventSlug,
      heatNumber: eventResults.heatNumber,
      bib: eventResults.bib,
      status: eventResults.status,
      timeCs: eventResults.timeCs,
      place: eventResults.place,
      name: eventResults.name,
      gender: eventResults.gender,
    })
    .from(eventResults)
    .where(inArray(eventResults.eventSlug, slugs))
    .orderBy(asc(eventResults.heatNumber), asc(eventResults.place));

  for (const row of rows) {
    if (row.status !== "finished" || row.timeCs === null || row.place === null) continue;
    let event = grouped.get(row.eventSlug);
    if (!event) {
      event = { heats: [] };
      grouped.set(row.eventSlug, event);
    }
    let heat: ResultHeat | undefined = event.heats.find((h) => h.number === row.heatNumber);
    if (!heat) {
      heat = { number: row.heatNumber, entries: [] };
      event.heats.push(heat);
    }
    heat.entries.push({
      place: row.place,
      bib: row.bib,
      gender: row.gender,
      name: row.name,
      timeCs: row.timeCs,
    });
  }
  return grouped;
}

/**
 * The results for each given event — imported rows where they exist, the
 * config sheet otherwise. Slugs with neither are absent from the map.
 */
export async function getMergedResults(slugs: string[]): Promise<Map<string, EventResults>> {
  const unique = [...new Set(slugs)];
  let fromDb = new Map<string, EventResults>();
  try {
    fromDb = await readDbResults(unique);
  } catch (error) {
    console.error("[results] event_results read failed; falling back to config sheets:", error);
  }

  const merged = new Map<string, EventResults>();
  for (const slug of unique) {
    const results = fromDb.get(slug) ?? getEventBySlug(slug)?.results;
    if (results && results.heats.some((h) => h.entries.length > 0)) merged.set(slug, results);
  }
  return merged;
}

/**
 * Completed events carrying results — the landing's leaderboard input, with
 * imported results overlaid onto each registry entry. The DB-first counterpart
 * of the registry's `getResultsEvents`, which only sees config sheets.
 */
export async function getResultsEventsWithDb(): Promise<EventSummary[]> {
  const past = getPastEvents();
  const merged = await getMergedResults(past.map((e) => e.slug));
  return past
    .filter((e) => merged.has(e.slug))
    .map((e) => ({ ...e, results: merged.get(e.slug) }));
}

/**
 * Where a user's imported results sit, keyed by event slug — the rows the
 * import linked to their registrations at commit time. A direct ref outranks
 * name matching in `findUserResults`: it was resolved from the (heat, bib)
 * lease, so a same-named stranger cannot shadow it.
 */
export async function getDirectResultRefs(
  registrationIds: string[],
): Promise<Map<string, { heatNumber: number; bib: number }>> {
  const refs = new Map<string, { heatNumber: number; bib: number }>();
  if (!db || registrationIds.length === 0) return refs;
  try {
    const rows = await db
      .select({
        eventSlug: eventResults.eventSlug,
        heatNumber: eventResults.heatNumber,
        bib: eventResults.bib,
      })
      .from(eventResults)
      .where(inArray(eventResults.registrationId, registrationIds));
    for (const row of rows) {
      if (!refs.has(row.eventSlug)) {
        refs.set(row.eventSlug, { heatNumber: row.heatNumber, bib: row.bib });
      }
    }
  } catch (error) {
    console.error("[results] direct result refs read failed; name matching only:", error);
  }
  return refs;
}
