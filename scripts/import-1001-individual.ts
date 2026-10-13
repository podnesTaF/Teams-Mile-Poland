/**
 * One-off: publish the 01.10.2026 night's individual mile (mile-2026-10-01),
 * transcribed from the timing operator's result screenshots (Male + Female,
 * "Heat-1" on the sheet). Heat 1 in the DB already holds the team run
 * (scripts/import-1001-results.ts) and `replaceHeatResults` replaces a heat
 * whole, so the individual mile goes in as heat 2 (men) and heat 3 (Ewa). Places are per gender
 * within the heat, as the sheet ranks them (same as 08-15).
 *
 * Every split is cross-checked against the lap times the sheet prints under
 * it, so a transcription slip fails loudly. Then participation is paid the
 * same way as the team import: PARTICIPATION_REWARD_ACER under
 * `participation:<registrationId>` (idempotent — runners already paid no-op).
 *
 *   npx tsx --env-file=.env.local scripts/import-1001-individual.ts
 *   npx tsx --env-file=.env.local scripts/import-1001-individual.ts --write
 */
import { and, eq, inArray } from "drizzle-orm";

import { eventRegistrations, eventResults, users } from "../src/db/schema";
import {
  replaceHeatResults,
  resolveRegistrations,
} from "../src/features/admin/results-import/data";
import type { ParsedResultRow } from "../src/features/admin/results-import/parse";
import { PARTICIPATION_REWARD_ACER, acerToMinor } from "../src/features/wallet/config";
import { recordWalletTransaction } from "../src/features/wallet/data";
import { getDb } from "../src/lib/db";
import { formatTime } from "../src/lib/events/time";

const SLUG = "mile-2026-10-01";
/** Men in heat 2; Ewa, the only woman, in her own heat 3 (owner, 2026-10-13). */
const heatOf = (gender: "M" | "F") => (gender === "M" ? 2 : 3);
const HEATS = [2, 3];
const WRITE = process.argv.includes("--write");
const POINTS = [9, 209, 409, 609, 809, 1009, 1209, 1409, 1609];

/** place, bib, name, gender, DoB (dd.mm.yyyy), cumulative readings, laps as printed. */
const SHEET: [number, number, string, "M" | "F", string, string, string][] = [
  [1, 2, "ROMANIUK Daniel", "M", "20.01.2001",
    "2.80 38.55 1:14.86 1:52.83 2:31.42 3:09.47 3:47.28 4:20.17 4:51.42",
    "35.75 36.31 37.97 38.59 38.05 37.81 32.89 31.25"],
  [2, 1, "CELINSKI Robert", "M", "30.01.1973",
    "2.38 38.26 1:14.27 1:52.55 2:31.33 3:09.34 3:47.49 4:24.16 5:00.51",
    "35.88 36.01 38.28 38.78 38.01 38.15 36.67 36.35"],
  [3, 6, "HOBRATKO Dmytro", "M", "08.12.1976",
    "2.73 38.14 1:14.52 1:53.57 2:32.19 3:11.71 3:53.33 4:34.62 5:15.60",
    "35.41 36.38 39.05 38.62 39.52 41.62 41.29 40.98"],
  [4, 9, "FRANCZUK Damian", "M", "27.02.1985",
    "2.41 41.54 1:22.41 2:06.96 2:52.50 3:38.32 4:24.67 5:10.24 5:54.33",
    "39.13 40.87 44.55 45.54 45.82 46.35 45.57 44.09"],
  [5, 11, "NAIKO Vitaliy", "M", "02.04.2005",
    "2.43 37.97 1:14.31 1:57.60 2:46.94 3:38.47 4:30.48 5:22.13 6:01.51",
    "35.54 36.34 43.29 49.34 51.53 52.01 51.65 39.38"],
  [6, 5, "DRABIANKOU Vadzim", "M", "07.05.1992",
    "2.66 40.87 1:21.94 2:06.17 2:53.56 3:41.21 4:29.46 5:16.62 6:03.26",
    "38.21 41.07 44.23 47.39 47.65 48.25 47.16 46.64"],
  [7, 12, "BEZUSHKO Sergio", "M", "24.04.1994",
    "2.67 41.45 1:22.71 2:07.42 2:53.01 3:39.92 4:30.50 5:21.68 6:07.76",
    "38.78 41.26 44.71 45.59 46.91 50.58 51.18 46.08"],
  [8, 10, "PIDNEBESNYI Iurii", "M", "05.12.1972",
    "2.82 43.57 1:28.39 2:17.10 3:05.89 3:54.65 4:45.45 5:35.24 6:24.70",
    "40.75 44.82 48.71 48.79 48.76 50.80 49.79 49.46"],
  [9, 8, "BIKHUNOV Vitaliy", "M", "20.01.1980",
    "2.32 43.59 1:32.35 2:27.76 3:24.54 4:21.73 5:15.37 6:09.68 6:53.98",
    "41.27 48.76 55.41 56.78 57.19 53.64 54.31 44.30"],
  [10, 7, "NESTERUK Ivan", "M", "02.09.1987",
    "2.73 46.17 1:36.76 2:35.75 3:32.63 4:30.37 5:27.74 6:26.36 7:20.41",
    "43.44 50.59 58.99 56.88 57.74 57.37 58.62 54.05"],
  [11, 4, "BROZEK Michal", "M", "28.08.1971",
    "3.44 55.48 1:57.78 3:05.37 4:13.90 5:26.06 6:36.20 7:50.49 9:04.39",
    "52.04 1:02.30 1:07.59 1:08.53 1:12.16 1:10.14 1:14.29 1:13.90"],
  [1, 3, "GRYBOS Ewa", "F", "15.06.1990",
    "3.03 39.85 1:18.71 1:59.07 2:41.49 3:25.72 4:09.14 4:52.21 5:33.02",
    "36.82 38.86 40.36 42.42 44.23 43.42 43.07 40.81"],
];

const cs = (t: string) => {
  const [m, s] = t.includes(":") ? t.split(":") : ["0", t];
  return Number(m) * 6000 + Math.round(Number(s) * 100);
};

function parseSheet(): ParsedResultRow[] {
  return SHEET.map(([place, bib, name, gender, dob, readings, laps], i) => {
    const r = readings.split(" ").map(cs);
    const l = laps.split(" ").map(cs);
    if (r.length !== POINTS.length || l.length !== POINTS.length - 1) {
      throw new Error(`${name}: ${r.length} readings / ${l.length} laps`);
    }
    for (let k = 1; k < r.length; k++) {
      if (r[k] - r[k - 1] !== l[k - 1]) {
        throw new Error(`${name}: ${POINTS[k]} m lap ${r[k] - r[k - 1]} cs ≠ printed ${l[k - 1]} cs`);
      }
    }
    const [d, m, y] = dob.split(".");
    return {
      sourceRow: i + 1,
      heat: heatOf(gender),
      bib,
      status: "finished" as const,
      timeCs: r.at(-1) as number,
      place,
      name,
      gender,
      dob: `${y}-${m}-${d}`,
      splits: POINTS.map((p, k) => ({ m: p, cs: r[k] })),
    };
  });
}

async function main() {
  const db = getDb();
  const host = new URL(process.env.DATABASE_URL ?? "postgres://unset/").hostname;
  console.log(`${WRITE ? "WRITE" : "dry-run"} against ${host}, event ${SLUG}, heats ${HEATS.join(", ")}`);

  const existing = await db
    .select({ name: eventResults.name, teamResultId: eventResults.teamResultId })
    .from(eventResults)
    .where(and(eq(eventResults.eventSlug, SLUG), inArray(eventResults.heatNumber, HEATS)));
  if (existing.some((r) => r.teamResultId !== null)) {
    throw new Error(`Heats ${HEATS.join(", ")} hold team rows — replacing it would delete them.`);
  }
  console.log(`Heats ${HEATS.join(", ")} currently hold ${existing.length} individual rows (replaced whole).`);

  const rows = await resolveRegistrations(SLUG, parseSheet());
  for (const r of rows) {
    console.log(
      `  heat ${r.heat} ${r.gender} #${String(r.place).padStart(2)}  bib ${String(r.bib).padStart(2)}  ` +
        `${formatTime(r.timeCs as number).padEnd(8)} ${r.name.padEnd(20)} [${r.matchedBy ?? "UNLINKED"}]`,
    );
  }
  const linked = rows.filter((r) => r.registrationId);
  console.log(`Linked: ${linked.length}/${rows.length}`);

  const regs = await db
    .select({ id: eventRegistrations.id, userId: eventRegistrations.userId, email: users.email })
    .from(eventRegistrations)
    .innerJoin(users, eq(eventRegistrations.userId, users.id))
    .where(inArray(eventRegistrations.id, linked.map((r) => r.registrationId as string)));
  const regById = new Map(regs.map((r) => [r.id, r]));
  for (const r of linked) console.log(`  ${r.name.padEnd(20)} → ${regById.get(r.registrationId as string)?.email}`);

  if (!WRITE) {
    console.log("\nDry-run complete — nothing written. Re-run with --write to import.");
    process.exit(0);
  }

  const outcome = await replaceHeatResults(SLUG, rows);
  console.log(`\nImported ${outcome.rows} rows into ${outcome.heats} heat.`);

  let written = 0;
  let already = 0;
  for (const r of linked) {
    const reg = regById.get(r.registrationId as string);
    if (!reg) throw new Error(`no registration row for ${r.name}`);
    const row = await recordWalletTransaction({
      userId: reg.userId,
      asset: "ACER",
      amountMinor: acerToMinor(PARTICIPATION_REWARD_ACER),
      kind: "participation_reward",
      reference: `event:${SLUG}`,
      idempotencyKey: `participation:${reg.id}`,
    });
    if (row) {
      written += 1;
      console.log(`  paid ${PARTICIPATION_REWARD_ACER} ACER → ${reg.email}`);
    } else already += 1;
  }
  console.log(`Paid ${written} participation rewards; ${already} already in the ledger (no-op).`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
