import { and, asc, eq, inArray, isNotNull, max, notInArray, sql } from "drizzle-orm";

import {
  eventHeats,
  eventRegistrations,
  eventResults,
  teamResults,
  userTeams,
  users,
  type ResultStatus,
} from "@/db/schema";
import { getDb } from "@/lib/db";
import { nameKey } from "@/lib/events/name-key";

import { setHeatForRegistrations } from "../heats-data";
import type { ParsedResultRow } from "./parse";
import type { ParsedTeam, ParsedTeamRunner } from "./parse-team";

/**
 * Data layer for the results import: resolve parsed rows to registrations,
 * summarize what is already imported, and commit a file heat-by-heat.
 */

/**
 * How a row found its registration — shown in the preview, stored nowhere.
 * `dob` is the file's date of birth plus at least one shared name token: it
 * links a transliteration ("Vladislav" / "Vladyslav") that the exact name key
 * misses, and is unique-or-nothing like the other two.
 */
export type MatchSource = "lease" | "name" | "dob" | null;

export type ResolvedRow = ParsedResultRow & {
  registrationId: string | null;
  matchedBy: MatchSource;
};

/**
 * Resolve each parsed row to a registration, deterministically or not at all:
 *
 * 1. the `(heat, bib)` lease — the registration seeded into that heat holding
 *    that bib (`bibReturnedAt` is ignored: the value is retained after return
 *    precisely so historical results stay accurate, ADR 0003);
 * 2. a unique name-key match against the event's roster;
 * 3. a unique date-of-birth match sharing a name token, when the file has DoB;
 * 4. otherwise unlinked (`registrationId: null`) — imported, never guessed.
 */
export async function resolveRegistrations(
  eventSlug: string,
  rows: ParsedResultRow[],
): Promise<ResolvedRow[]> {
  const resolve = await rosterResolver(eventSlug);
  return rows.map((row) => ({ ...row, ...resolve(row) }));
}

/** What the resolver needs from a parsed row, individual or team. */
type Linkable = { heat: number | null; bib: number | null; name: string; dob: string | null };

/** The event's resolver, built once per import (steps in {@link resolveRegistrations}). */
async function rosterResolver(
  eventSlug: string,
): Promise<(row: Linkable) => { registrationId: string | null; matchedBy: MatchSource }> {
  const db = getDb();
  const roster = await db
    .select({
      id: eventRegistrations.id,
      bib: eventRegistrations.bib,
      heatNumber: eventHeats.number,
      firstName: users.firstName,
      lastName: users.lastName,
      fallbackName: users.name,
      dateOfBirth: users.dateOfBirth,
    })
    .from(eventRegistrations)
    .innerJoin(users, eq(eventRegistrations.userId, users.id))
    .leftJoin(eventHeats, eq(eventRegistrations.heatId, eventHeats.id))
    .where(eq(eventRegistrations.eventSlug, eventSlug));

  // (heat, bib) → registration. The partial unique index guarantees a held bib
  // is unique per event; after return the same (heat, bib) cannot recur either,
  // because a bib returns only when its heat finishes. Guard anyway: an
  // ambiguous key resolves to nobody rather than to somebody.
  const byLease = new Map<string, string | null>();
  const byName = new Map<string, string | null>();
  const byDob = new Map<string, { id: string; tokens: Set<string> }[]>();
  for (const r of roster) {
    if (r.heatNumber !== null && r.bib !== null) {
      const key = `${r.heatNumber}:${r.bib}`;
      byLease.set(key, byLease.has(key) ? null : r.id);
    }
    const key = nameKey([r.firstName, r.lastName].filter(Boolean).join(" ") || r.fallbackName);
    if (key) byName.set(key, byName.has(key) ? null : r.id);
    if (key && r.dateOfBirth) {
      const dob = r.dateOfBirth.toISOString().slice(0, 10);
      byDob.set(dob, [...(byDob.get(dob) ?? []), { id: r.id, tokens: new Set(key.split(" ")) }]);
    }
  }

  return (row) => {
    const leased =
      row.heat !== null && row.bib !== null ? byLease.get(`${row.heat}:${row.bib}`) : undefined;
    if (leased) return { registrationId: leased, matchedBy: "lease" };
    const key = nameKey(row.name);
    const named = byName.get(key);
    if (named) return { registrationId: named, matchedBy: "name" };
    if (row.dob) {
      const tokens = key.split(" ");
      const hits = (byDob.get(row.dob) ?? []).filter((c) => tokens.some((t) => c.tokens.has(t)));
      if (hits.length === 1) return { registrationId: hits[0].id, matchedBy: "dob" };
    }
    return { registrationId: null, matchedBy: null };
  };
}

export type ResolvedTeamRunner = ParsedTeamRunner & {
  registrationId: string | null;
  matchedBy: MatchSource;
};

export type ResolvedTeam = Omit<ParsedTeam, "runners"> & {
  /** The platform team whose name matches exactly one `user_teams` row. */
  teamId: string | null;
  runners: ResolvedTeamRunner[];
};

/**
 * Resolve a team file: each runner through the same roster resolver as an
 * individual row (no lease — a team seat number is not a bib lease), and each
 * team to the one platform team with that name, compared case-insensitively.
 * Accents are deliberately *not* folded: "AB Praga-Poludnie" and "AB PRAGA
 * POŁUDNIE" are two platform teams, and folding would turn a clean match into
 * an ambiguous one.
 */
export async function resolveTeamResults(
  eventSlug: string,
  teams: ParsedTeam[],
): Promise<ResolvedTeam[]> {
  const resolve = await rosterResolver(eventSlug);
  const names = [...new Set(teams.map((t) => t.name.trim().toLowerCase()))];
  const platform =
    names.length === 0
      ? []
      : await getDb()
          .select({ id: userTeams.id, name: userTeams.name })
          .from(userTeams)
          .where(inArray(sql`lower(trim(${userTeams.name}))`, names));
  const teamIdByName = new Map<string, string | null>();
  for (const t of platform) {
    const key = t.name.trim().toLowerCase();
    teamIdByName.set(key, teamIdByName.has(key) ? null : t.id);
  }

  return teams.map((team) => ({
    ...team,
    teamId: teamIdByName.get(team.name.trim().toLowerCase()) ?? null,
    runners: team.runners.map((runner) => ({
      ...runner,
      ...resolve({ heat: null, bib: null, name: runner.name, dob: runner.dob }),
    })),
  }));
}

/** What one heat currently holds in `event_results` — the page's status table. */
export type HeatResultsState = {
  heatNumber: number;
  rows: number;
  finishers: number;
  linked: number;
  importedAt: Date;
};

/** Imported heats for an event, lowest heat first; empty when nothing imported. */
export async function getResultsState(eventSlug: string): Promise<HeatResultsState[]> {
  const db = getDb();
  const rows = await db
    .select({
      heatNumber: eventResults.heatNumber,
      rows: sql<number>`count(*)::int`,
      finishers: sql<number>`count(*) filter (where ${eventResults.status} = 'finished')::int`,
      linked: sql<number>`count(${eventResults.registrationId})::int`,
      importedAt: max(eventResults.importedAt),
    })
    .from(eventResults)
    .where(eq(eventResults.eventSlug, eventSlug))
    .groupBy(eventResults.heatNumber)
    .orderBy(asc(eventResults.heatNumber));

  return rows.map((r) => ({ ...r, importedAt: r.importedAt ?? new Date(0) }));
}

/** One imported row as the admin results table shows it. */
export type ImportedResultRow = {
  heatNumber: number;
  /** Finishing place within the heat; null for DNF/DNS/DSQ. */
  place: number | null;
  bib: number | null;
  status: ResultStatus;
  /** Net time in hundredths of a second; null for DNF/DNS/DSQ. */
  timeCs: number | null;
  /** Name exactly as the timing system recorded it. */
  name: string;
  gender: "M" | "F";
  /** Account name of the linked runner; null when the row is unlinked. */
  linkedTo: string | null;
};

/** Non-finishers sort below finishers within a heat, in this order. */
const STATUS_ORDER: Record<ResultStatus, number> = { finished: 0, dnf: 1, dsq: 2, dns: 3 };

/**
 * Every imported row for an event with its linked account resolved — the admin
 * page's full table, unlike the public reader deliberately including who each
 * row is (or is not) linked to. Heats ascending; finishers by place, then
 * DNF/DSQ/DNS.
 */
export async function getImportedResults(eventSlug: string): Promise<ImportedResultRow[]> {
  const db = getDb();
  const rows = await db
    .select({
      heatNumber: eventResults.heatNumber,
      place: eventResults.place,
      bib: eventResults.bib,
      status: eventResults.status,
      timeCs: eventResults.timeCs,
      name: eventResults.name,
      gender: eventResults.gender,
      linkedFirst: users.firstName,
      linkedLast: users.lastName,
      linkedFallback: users.name,
    })
    .from(eventResults)
    .leftJoin(eventRegistrations, eq(eventResults.registrationId, eventRegistrations.id))
    .leftJoin(users, eq(eventRegistrations.userId, users.id))
    .where(eq(eventResults.eventSlug, eventSlug));

  return rows
    .map(({ linkedFirst, linkedLast, linkedFallback, ...row }) => ({
      ...row,
      linkedTo: [linkedFirst, linkedLast].filter(Boolean).join(" ") || linkedFallback || null,
    }))
    .sort(
      (a, b) =>
        a.heatNumber - b.heatNumber ||
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
        (a.place ?? Infinity) - (b.place ?? Infinity) ||
        (a.bib ?? Infinity) - (b.bib ?? Infinity),
    );
}

/** Heat numbers in the file that have no `event_heats` row — a preview warning. */
export async function unknownHeatNumbers(
  eventSlug: string,
  heatNumbers: number[],
): Promise<number[]> {
  if (heatNumbers.length === 0) return [];
  const db = getDb();
  const known = await db
    .select({ number: eventHeats.number })
    .from(eventHeats)
    .where(eq(eventHeats.eventSlug, eventSlug));
  const knownSet = new Set(known.map((h) => h.number));
  return heatNumbers.filter((n) => !knownSet.has(n));
}

/* ── seeding finals from imported results ───────────────────────────── */

/** One finisher in the qualification standings, best time first. */
export type Qualifier = {
  heatNumber: number;
  bib: number | null;
  name: string;
  gender: "M" | "F";
  timeCs: number;
  /**
   * The registration the import linked this row to — the only handle seeding
   * has. `null` means the row is real but has nobody to assign (manual timing
   * edit, walk-up the file spelled differently): surfaced, never guessed.
   */
  registrationId: string | null;
};

/**
 * The top `limit` finishers across the event's imported heats, ordered by net
 * time. Rows from `excludeHeatNumbers` are left out — a final's own imported
 * results must never feed a re-seed of that same final.
 *
 * Unlinked rows are *kept in the window* rather than skipped past: skipping
 * would silently promote the (limit+1)-th time into the final while the true
 * qualifier — who exists, just unmatched — is dropped. The caller seeds the
 * linked rows and shows the unlinked ones as the warning they are.
 */
export async function topQualifiers(
  eventSlug: string,
  opts: { limit: number; excludeHeatNumbers?: number[] },
): Promise<Qualifier[]> {
  if (opts.limit < 1) return [];
  const db = getDb();
  const exclude = opts.excludeHeatNumbers ?? [];
  const rows = await db
    .select({
      heatNumber: eventResults.heatNumber,
      bib: eventResults.bib,
      name: eventResults.name,
      gender: eventResults.gender,
      timeCs: eventResults.timeCs,
      registrationId: eventResults.registrationId,
    })
    .from(eventResults)
    .where(
      and(
        eq(eventResults.eventSlug, eventSlug),
        eq(eventResults.status, "finished"),
        isNotNull(eventResults.timeCs),
        ...(exclude.length > 0 ? [notInArray(eventResults.heatNumber, exclude)] : []),
      ),
    )
    .orderBy(asc(eventResults.timeCs), asc(eventResults.heatNumber), asc(eventResults.bib));

  // One slot per runner: a registration that finished twice (re-ran after a
  // timing mishap) qualifies once, on its best time. Unlinked rows have no
  // identity to collapse on, so each stays its own slot.
  const seen = new Set<string>();
  const out: Qualifier[] = [];
  for (const r of rows) {
    if (r.registrationId) {
      if (seen.has(r.registrationId)) continue;
      seen.add(r.registrationId);
    }
    out.push({ ...r, timeCs: r.timeCs as number });
    if (out.length === opts.limit) break;
  }
  return out;
}

export type SeedFinalOutcome =
  | { outcome: "seeded"; seeded: number; unlinked: number }
  /** No linked finished results outside the target heat — nothing to seed from. */
  | { outcome: "no-qualifiers"; unlinked: number }
  | { outcome: "missing-heat" };

/**
 * Seed the top `count` qualifiers into the target heat — the bridge from
 * imported qualification results to the finals card.
 *
 * Moves registrations only (`setHeatForRegistrations`), so everything else
 * about the card keeps its existing rules: nobody is emailed until the admin
 * presses publish, and the already-idempotent re-publish path carries the
 * delta. Re-seeding after a corrected re-import is likewise idempotent — the
 * same runners end up in the same heat.
 */
export async function seedTopQualifiers(
  eventSlug: string,
  targetHeatId: string,
  count: number,
): Promise<SeedFinalOutcome> {
  const db = getDb();
  const [target] = await db
    .select({ id: eventHeats.id, number: eventHeats.number })
    .from(eventHeats)
    .where(and(eq(eventHeats.id, targetHeatId), eq(eventHeats.eventSlug, eventSlug)))
    .limit(1);
  if (!target) return { outcome: "missing-heat" };

  const qualifiers = await topQualifiers(eventSlug, {
    limit: count,
    excludeHeatNumbers: [target.number],
  });
  const seedable = qualifiers.filter((q) => q.registrationId !== null);
  const unlinked = qualifiers.length - seedable.length;
  if (seedable.length === 0) return { outcome: "no-qualifiers", unlinked };

  const seeded = await setHeatForRegistrations(
    eventSlug,
    targetHeatId,
    seedable.map((q) => q.registrationId as string),
  );
  return { outcome: "seeded", seeded, unlinked };
}

/**
 * Commit resolved rows: every heat present in the file is replaced whole, in
 * one transaction — re-importing a corrected timing file is idempotent, and a
 * heat absent from the file is left alone (mid-event imports arrive heat by
 * heat).
 */
export async function replaceHeatResults(
  eventSlug: string,
  rows: ResolvedRow[],
): Promise<{ heats: number; rows: number }> {
  const heatNumbers = [...new Set(rows.map((r) => r.heat))];
  if (heatNumbers.length === 0) return { heats: 0, rows: 0 };

  const db = getDb();
  await db.transaction(async (tx) => {
    // A heat is replaced whole, whichever layout filled it last time.
    await tx
      .delete(teamResults)
      .where(and(eq(teamResults.eventSlug, eventSlug), inArray(teamResults.heatNumber, heatNumbers)));
    await tx
      .delete(eventResults)
      .where(
        and(eq(eventResults.eventSlug, eventSlug), inArray(eventResults.heatNumber, heatNumbers)),
      );
    await tx.insert(eventResults).values(
      rows.map((r) => ({
        eventSlug,
        heatNumber: r.heat,
        bib: r.bib,
        status: r.status,
        timeCs: r.timeCs,
        place: r.place,
        name: r.name,
        gender: r.gender,
        registrationId: r.registrationId,
        splits: r.splits,
      })),
    );
  });

  return { heats: heatNumbers.length, rows: rows.length };
}

/**
 * Commit a team file with the same per-heat replace as
 * {@link replaceHeatResults}: every heat in the file is deleted whole, team
 * and individual rows alike, then rewritten — a corrected re-import is
 * idempotent.
 *
 * A RACER's `place` is derived here, among the heat's finished RACERS by mile
 * time: the file places teams, not runners, and every mile reader expects a
 * finisher to carry a place.
 */
export async function replaceTeamHeatResults(
  eventSlug: string,
  teams: ResolvedTeam[],
): Promise<{ heats: number; teams: number; rows: number }> {
  const heatNumbers = [...new Set(teams.map((t) => t.heat))];
  if (heatNumbers.length === 0) return { heats: 0, teams: 0, rows: 0 };

  const racerPlace = new Map<ResolvedTeamRunner, number>();
  for (const heat of heatNumbers) {
    teams
      .filter((t) => t.heat === heat)
      .flatMap((t) => t.runners)
      .filter((r) => r.role === "racer" && r.status === "finished" && r.timeCs !== null)
      .sort((a, b) => (a.timeCs as number) - (b.timeCs as number))
      .forEach((r, i) => racerPlace.set(r, i + 1));
  }

  const db = getDb();
  let rows = 0;
  await db.transaction(async (tx) => {
    await tx
      .delete(teamResults)
      .where(and(eq(teamResults.eventSlug, eventSlug), inArray(teamResults.heatNumber, heatNumbers)));
    await tx
      .delete(eventResults)
      .where(
        and(eq(eventResults.eventSlug, eventSlug), inArray(eventResults.heatNumber, heatNumbers)),
      );
    for (const team of teams) {
      const [inserted] = await tx
        .insert(teamResults)
        .values({
          eventSlug,
          heatNumber: team.heat,
          teamName: team.name,
          teamId: team.teamId,
          status: team.status,
          place: team.place,
          timeCs: team.timeCs,
        })
        .returning({ id: teamResults.id });
      if (team.runners.length === 0) continue;
      await tx.insert(eventResults).values(
        team.runners.map((r) => ({
          eventSlug,
          heatNumber: team.heat,
          bib: r.bib,
          status: r.status,
          timeCs: r.timeCs,
          place: racerPlace.get(r) ?? null,
          name: r.name,
          gender: r.gender,
          registrationId: r.registrationId,
          splits: r.splits,
          teamResultId: inserted.id,
          raceRole: r.role,
          pairNo: r.pairNo,
          legTimeCs: r.legTimeCs,
        })),
      );
      rows += team.runners.length;
    }
  });

  return { heats: heatNumbers.length, teams: teams.length, rows };
}
