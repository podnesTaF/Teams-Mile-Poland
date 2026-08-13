import { and, asc, eq, inArray, isNotNull, max, notInArray, sql } from "drizzle-orm";

import { eventHeats, eventRegistrations, eventResults, users } from "@/db/schema";
import { getDb } from "@/lib/db";
import { nameKey } from "@/lib/events/name-key";

import { setHeatForRegistrations } from "../heats-data";
import type { ParsedResultRow } from "./parse";

/**
 * Data layer for the results import: resolve parsed rows to registrations,
 * summarize what is already imported, and commit a file heat-by-heat.
 */

/** How a row found its registration — shown in the preview, stored nowhere. */
export type MatchSource = "lease" | "name" | null;

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
 * 3. otherwise unlinked (`registrationId: null`) — imported, never guessed.
 */
export async function resolveRegistrations(
  eventSlug: string,
  rows: ParsedResultRow[],
): Promise<ResolvedRow[]> {
  const db = getDb();
  const roster = await db
    .select({
      id: eventRegistrations.id,
      bib: eventRegistrations.bib,
      heatNumber: eventHeats.number,
      firstName: users.firstName,
      lastName: users.lastName,
      fallbackName: users.name,
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
  for (const r of roster) {
    if (r.heatNumber !== null && r.bib !== null) {
      const key = `${r.heatNumber}:${r.bib}`;
      byLease.set(key, byLease.has(key) ? null : r.id);
    }
    const key = nameKey([r.firstName, r.lastName].filter(Boolean).join(" ") || r.fallbackName);
    if (key) byName.set(key, byName.has(key) ? null : r.id);
  }

  return rows.map((row) => {
    const leased = byLease.get(`${row.heat}:${row.bib}`);
    if (leased) return { ...row, registrationId: leased, matchedBy: "lease" };
    const named = byName.get(nameKey(row.name));
    if (named) return { ...row, registrationId: named, matchedBy: "name" };
    return { ...row, registrationId: null, matchedBy: null };
  });
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
  bib: number;
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
      })),
    );
  });

  return { heats: heatNumbers.length, rows: rows.length };
}
