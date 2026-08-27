import { and, asc, eq, inArray, sql } from "drizzle-orm";

import { eventRegistrations, eventResults, legacyParticipations } from "@/db/schema";
import { getDb } from "@/lib/db";
import { getEventBySlug } from "@/lib/events/registry";
import { getMergedResults } from "@/lib/events/results-data";
import { findUserResults, type ParticipationRef } from "@/lib/events/user-results";
import type { EventSummary } from "@/lib/events/types";

/**
 * A runner's best mile across the season, as the roster shows it beside their
 * registration — the qualification evidence for seeding the strongest heat of a
 * final.
 *
 * Computed with exactly the pipeline the profile page and `getUserDetail` use —
 * same participation set, same `findUserResults` matcher, direct import-time
 * refs outranking the name match — so the roster can never claim a different
 * best than the runner's own profile or their admin detail page. The only
 * departure is the **exclusion of the roster's own event**: a "season best"
 * column on a final's roster means what the runner ran *before* this night, and
 * must not start echoing the final's own results back once they are imported.
 *
 * Batched for a table: one read over each of the three tables for the whole
 * page of runners, not one `getUserDetail` per row.
 */
export type SeasonBest = {
  /** Best (lowest) net time across the runner's matched results, in hundredths. */
  timeCs: number;
  /** AB-mile level of that time (1 = top, 16 = entry). */
  level: number;
  eventSlug: string;
  /** ISO date of the race the best was set at. */
  date: string;
  /** Locale-independent display date, e.g. "01 · 08 · 2026". */
  shortDate: string;
};

/** The identity slice of a roster row this module needs. */
export type SeasonBestRunner = {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  /** The single-field account name, the fallback when neither part is set. */
  name: string;
};

/**
 * Season bests for a set of runners, keyed by user id. Runners with no matched
 * result are simply absent — an empty cell is the honest answer, and the
 * caller renders it as one.
 *
 * `excludeSlug` is the event whose roster is asking; see the module docblock
 * for why its own results never count.
 */
export async function getSeasonBests(
  runners: SeasonBestRunner[],
  excludeSlug: string,
): Promise<Map<string, SeasonBest>> {
  const bests = new Map<string, SeasonBest>();
  const userIds = [...new Set(runners.map((r) => r.userId))];
  if (userIds.length === 0) return bests;

  const db = getDb();

  // Every participation of every runner on the page, in two reads. Registrations
  // are read unfiltered (a cancelled row still carries the bib lease a result may
  // have been recorded against) and legacy rows only when attended — the same
  // participation set `getUserDetail` assembles per user.
  const [registrationRows, legacyRows] = await Promise.all([
    db
      .select({
        id: eventRegistrations.id,
        userId: eventRegistrations.userId,
        eventSlug: eventRegistrations.eventSlug,
        bib: eventRegistrations.bib,
      })
      .from(eventRegistrations)
      .where(inArray(eventRegistrations.userId, userIds)),
    db
      .select({ userId: legacyParticipations.userId, eventSlug: legacyParticipations.eventSlug })
      .from(legacyParticipations)
      .where(
        and(inArray(legacyParticipations.userId, userIds), eq(legacyParticipations.attended, true)),
      ),
  ]);

  const participationsByUser = new Map<string, ParticipationRef[]>();
  const add = (userId: string, ref: ParticipationRef) => {
    if (ref.eventSlug === excludeSlug) return;
    const list = participationsByUser.get(userId);
    if (list) list.push(ref);
    else participationsByUser.set(userId, [ref]);
  };
  for (const r of registrationRows) add(r.userId, { eventSlug: r.eventSlug, bib: r.bib });
  for (const r of legacyRows) add(r.userId, { eventSlug: r.eventSlug });

  // Events and result sheets, resolved once for the whole page rather than per
  // runner — `findUserResults` stays the pure matcher it is everywhere else.
  const slugs = [
    ...new Set([...participationsByUser.values()].flat().map((p) => p.eventSlug)),
  ];
  const eventsBySlug = new Map<string, EventSummary>();
  for (const slug of slugs) {
    const event = await getEventBySlug(slug);
    if (event) eventsBySlug.set(slug, event);
  }
  const resultsBySlug = await getMergedResults(slugs);

  // Direct refs — the rows the import linked to a registration at commit time —
  // batched across every runner, then regrouped per user so each gets the map
  // shape `findUserResults` takes. Same pick as `getDirectResultRefs`: the
  // fastest finished row per (user, event) wins.
  const userByRegistration = new Map(registrationRows.map((r) => [r.id, r.userId]));
  const linkableIds = registrationRows
    .filter((r) => r.eventSlug !== excludeSlug)
    .map((r) => r.id);
  const refsByUser = new Map<string, Map<string, { heatNumber: number; bib: number }>>();
  if (linkableIds.length > 0) {
    const refRows = await db
      .select({
        registrationId: eventResults.registrationId,
        eventSlug: eventResults.eventSlug,
        heatNumber: eventResults.heatNumber,
        bib: eventResults.bib,
      })
      .from(eventResults)
      .where(inArray(eventResults.registrationId, linkableIds))
      .orderBy(
        sql`(${eventResults.status} = 'finished') desc`,
        sql`${eventResults.timeCs} asc nulls last`,
        asc(eventResults.heatNumber),
      );
    for (const row of refRows) {
      const userId = row.registrationId ? userByRegistration.get(row.registrationId) : undefined;
      if (!userId) continue;
      let refs = refsByUser.get(userId);
      if (!refs) {
        refs = new Map();
        refsByUser.set(userId, refs);
      }
      if (!refs.has(row.eventSlug)) {
        refs.set(row.eventSlug, { heatNumber: row.heatNumber, bib: row.bib });
      }
    }
  }

  for (const runner of runners) {
    if (bests.has(runner.userId)) continue;
    const participations = participationsByUser.get(runner.userId);
    if (!participations || participations.length === 0) continue;

    const fullName =
      [runner.firstName, runner.lastName].filter(Boolean).join(" ") || runner.name;
    const matches = findUserResults(
      fullName,
      participations,
      resultsBySlug,
      refsByUser.get(runner.userId) ?? new Map(),
      eventsBySlug,
    );
    let best: SeasonBest | null = null;
    for (const m of matches) {
      if (best === null || m.entry.timeCs < best.timeCs) {
        best = {
          timeCs: m.entry.timeCs,
          level: m.level,
          eventSlug: m.event.slug,
          date: m.event.date,
          shortDate: m.event.shortDate,
        };
      }
    }
    if (best) bests.set(runner.userId, best);
  }

  return bests;
}
