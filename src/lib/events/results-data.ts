import { and, asc, eq, inArray, sql } from "drizzle-orm";

import { eventResults, teamResults, type ResultSplit, type ResultStatus } from "@/db/schema";
import type { RaceRole } from "@/features/teams/rating-rules";
import { db } from "@/lib/db";
import { getEventBySlug, getPastEvents } from "./registry";
import type { EventResults, EventSummary, Gender, ResultHeat } from "./types";
import type { DirectResultRef } from "./user-results";

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
      id: eventResults.id,
      eventSlug: eventResults.eventSlug,
      heatNumber: eventResults.heatNumber,
      bib: eventResults.bib,
      status: eventResults.status,
      timeCs: eventResults.timeCs,
      place: eventResults.place,
      name: eventResults.name,
      gender: eventResults.gender,
      splits: eventResults.splits,
      teamName: teamResults.teamName,
      teamPlace: teamResults.place,
      teamTimeCs: teamResults.timeCs,
    })
    .from(eventResults)
    .leftJoin(teamResults, eq(eventResults.teamResultId, teamResults.id))
    .where(inArray(eventResults.eventSlug, slugs))
    .orderBy(asc(eventResults.heatNumber), asc(eventResults.place));

  for (const row of rows) {
    // A mile needs a mile time: team ACEs/JOKERs (time_cs null) never enter
    // the leaderboard or the profile's mile cards through here.
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
      id: row.id,
      place: row.place,
      bib: row.bib,
      gender: row.gender,
      name: row.name,
      timeCs: row.timeCs,
      splits: row.splits,
      team:
        row.teamName === null
          ? null
          : { name: row.teamName, place: row.teamPlace, timeCs: row.teamTimeCs },
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
    const results = fromDb.get(slug) ?? (await getEventBySlug(slug))?.results;
    if (results && results.heats.some((h) => h.entries.length > 0)) merged.set(slug, results);
  }
  return merged;
}

/* ── the per-event results page's projection ────────────────────────── */

/**
 * One imported result as the public per-event page shows it — unlike
 * `ResultEntry`, non-finishers are first-class: a "DNF" row is the honest
 * mid-event answer to "where did I place?", where the finishers-only landing
 * leaderboard would silently pretend the runner was never there. A deliberate
 * new type rather than nullable fields bolted onto `ResultEntry`, so the
 * leaderboard/profile model keeps its "every entry has a time" invariant.
 */
export type PublicResultRow = {
  /** Row id for an imported result; a stable React key. Absent on config sheets. */
  id?: string;
  status: ResultStatus;
  /** Finishing place within the heat; null for DNF/DNS/DSQ and team ACE/JOKER. */
  place: number | null;
  bib: number | null;
  gender: Gender;
  name: string;
  /** Net mile time in hundredths of a second; null for DNF/DNS/DSQ and ACE/JOKER. */
  timeCs: number | null;
  /** Cumulative timing-point readings; null/absent when the import had none. */
  splits?: ResultSplit[] | null;
  /** Team rows only (ADR 0014): RACER, ACE ("Pacer" in the timing file) or JOKER. */
  role?: RaceRole | null;
  pairNo?: number | null;
  /** ACE: handover reading; JOKER: finish (the pair's mile). */
  legTimeCs?: number | null;
};

/** One team's run in a heat, with its runners in running order. */
export type PublicTeamResult = {
  id: string;
  name: string;
  status: ResultStatus;
  place: number | null;
  timeCs: number | null;
  /** RACERS fastest first, then pair 1 (ACE, JOKER), then pair 2. */
  members: PublicResultRow[];
};

export type PublicResultsHeat = {
  number: number;
  /** Individual runs. */
  rows: PublicResultRow[];
  /** Team runs; empty on an individual heat. */
  teams: PublicTeamResult[];
};

export type PublicEventResults = { heats: PublicResultsHeat[] };

/** Non-finishers sort below finishers, in this order within a heat. */
const STATUS_ORDER: Record<ResultStatus, number> = { finished: 0, dnf: 1, dsq: 2, dns: 3 };

const byPlace = (
  a: { status: ResultStatus; place: number | null; bib?: number | null },
  b: { status: ResultStatus; place: number | null; bib?: number | null },
) =>
  STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
  (a.place ?? Infinity) - (b.place ?? Infinity) ||
  (a.bib ?? Infinity) - (b.bib ?? Infinity);

/** Running order within a team: RACERS by time, then each pair ACE → JOKER. */
function memberOrder(row: PublicResultRow): number {
  if (row.role === "ace") return 1000 * (row.pairNo ?? 9);
  if (row.role === "joker") return 1000 * (row.pairNo ?? 9) + 1;
  return 0;
}

/**
 * Everything imported for one event, grouped per heat: finishers in place
 * order, then DNF/DSQ/DNS; team runs grouped under their team. Falls back to
 * the config sheet (all finishers, by definition of that model) for legacy
 * events never imported, and — like `getMergedResults` — degrades to that
 * fallback rather than throwing when the database is missing or unreachable.
 */
export async function getPublicResults(slug: string): Promise<PublicEventResults | null> {
  if (db) {
    try {
      const [rows, teams] = await Promise.all([
        db
          .select({
            id: eventResults.id,
            heatNumber: eventResults.heatNumber,
            teamResultId: eventResults.teamResultId,
            status: eventResults.status,
            place: eventResults.place,
            bib: eventResults.bib,
            gender: eventResults.gender,
            name: eventResults.name,
            timeCs: eventResults.timeCs,
            splits: eventResults.splits,
            role: eventResults.raceRole,
            pairNo: eventResults.pairNo,
            legTimeCs: eventResults.legTimeCs,
          })
          .from(eventResults)
          .where(eq(eventResults.eventSlug, slug))
          .orderBy(asc(eventResults.heatNumber)),
        db
          .select({
            id: teamResults.id,
            heatNumber: teamResults.heatNumber,
            name: teamResults.teamName,
            status: teamResults.status,
            place: teamResults.place,
            timeCs: teamResults.timeCs,
          })
          .from(teamResults)
          .where(eq(teamResults.eventSlug, slug)),
      ]);

      if (rows.length > 0 || teams.length > 0) {
        const heats = new Map<number, PublicResultsHeat>();
        const heat = (number: number): PublicResultsHeat => {
          let h = heats.get(number);
          if (!h) {
            h = { number, rows: [], teams: [] };
            heats.set(number, h);
          }
          return h;
        };
        const teamById = new Map<string, PublicTeamResult>();
        for (const { heatNumber, ...team } of teams) {
          const block = { ...team, members: [] };
          teamById.set(team.id, block);
          heat(heatNumber).teams.push(block);
        }
        for (const { heatNumber, teamResultId, ...row } of rows) {
          const team = teamResultId ? teamById.get(teamResultId) : undefined;
          if (team) team.members.push(row);
          else heat(heatNumber).rows.push(row);
        }
        for (const h of heats.values()) {
          h.rows.sort(byPlace);
          h.teams.sort(byPlace);
          for (const t of h.teams) {
            t.members.sort((a, b) => memberOrder(a) - memberOrder(b) || byPlace(a, b));
          }
        }
        return { heats: [...heats.values()].sort((a, b) => a.number - b.number) };
      }
    } catch (error) {
      console.error("[results] public results read failed; falling back to config sheet:", error);
    }
  }

  const sheet = (await getEventBySlug(slug))?.results;
  if (!sheet || !sheet.heats.some((h) => h.entries.length > 0)) return null;
  return {
    heats: sheet.heats.map((h) => ({
      number: h.number,
      rows: h.entries.map((e) => ({ status: "finished" as const, ...e })),
      teams: [],
    })),
  };
}

/**
 * Completed events carrying results — the landing's leaderboard input, with
 * imported results overlaid onto each registry entry. The DB-first counterpart
 * of the registry's `getResultsEvents`, which only sees config sheets.
 */
export async function getResultsEventsWithDb(): Promise<EventSummary[]> {
  const past = await getPastEvents();
  const merged = await getMergedResults(past.map((e) => e.slug));
  return past.filter((e) => merged.has(e.slug)).map((e) => ({ ...e, results: merged.get(e.slug) }));
}

/**
 * Where a user's imported results sit, keyed by event slug — the rows the
 * import linked to their registrations at commit time. A direct ref outranks
 * name matching in `findUserResults`: it was resolved from the (heat, bib)
 * lease, so a same-named stranger cannot shadow it.
 *
 * Mid-event, one registration can legitimately hold several linked rows — a
 * qualification and a final — so the pick is deterministic: the fastest
 * finished row (the profile card shows the runner's best of the night, and a
 * ref to a non-finisher would only fall back to name matching anyway).
 */
export async function getDirectResultRefs(
  registrationIds: string[],
): Promise<Map<string, DirectResultRef>> {
  const refs = new Map<string, DirectResultRef>();
  if (!db || registrationIds.length === 0) return refs;
  try {
    const rows = await db
      .select({ id: eventResults.id, eventSlug: eventResults.eventSlug })
      .from(eventResults)
      .where(inArray(eventResults.registrationId, registrationIds))
      .orderBy(
        sql`(${eventResults.status} = 'finished') desc`,
        sql`${eventResults.timeCs} asc nulls last`,
        asc(eventResults.heatNumber),
      );
    for (const row of rows) {
      if (!refs.has(row.eventSlug)) {
        refs.set(row.eventSlug, { resultId: row.id });
      }
    }
  } catch (error) {
    console.error("[results] direct result refs read failed; name matching only:", error);
  }
  return refs;
}

/**
 * A registrant's team legs as ACE or JOKER — the team runs that are not a
 * mile and so never reach `findUserResults` (which reads `time_cs`). The
 * profile shows them beside the mile cards: role, leg reading, team place and
 * team time, and the splits. A RACER's run is a mile and arrives through the
 * ordinary path, carrying its team on `ResultEntry.team`.
 */
export type TeamLeg = {
  id: string;
  eventSlug: string;
  heatNumber: number;
  role: RaceRole;
  pairNo: number | null;
  status: ResultStatus;
  legTimeCs: number | null;
  splits: ResultSplit[] | null;
  team: { name: string; place: number | null; timeCs: number | null };
};

export async function getTeamLegs(registrationIds: string[]): Promise<TeamLeg[]> {
  if (!db || registrationIds.length === 0) return [];
  try {
    const rows = await db
      .select({
        id: eventResults.id,
        eventSlug: eventResults.eventSlug,
        heatNumber: eventResults.heatNumber,
        role: eventResults.raceRole,
        pairNo: eventResults.pairNo,
        status: eventResults.status,
        legTimeCs: eventResults.legTimeCs,
        splits: eventResults.splits,
        teamName: teamResults.teamName,
        teamPlace: teamResults.place,
        teamTimeCs: teamResults.timeCs,
      })
      .from(eventResults)
      .innerJoin(teamResults, eq(eventResults.teamResultId, teamResults.id))
      .where(
        and(
          inArray(eventResults.registrationId, registrationIds),
          inArray(eventResults.raceRole, ["ace", "joker"]),
        ),
      )
      .orderBy(asc(eventResults.eventSlug), asc(eventResults.heatNumber));
    return rows.map(({ teamName, teamPlace, teamTimeCs, role, ...row }) => ({
      ...row,
      role: role as RaceRole,
      team: { name: teamName, place: teamPlace, timeCs: teamTimeCs },
    }));
  } catch (error) {
    console.error("[results] team legs read failed:", error);
    return [];
  }
}
