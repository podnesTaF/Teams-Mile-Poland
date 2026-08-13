/**
 * Round-trip verification for the timing results import (timing integration
 * slice): parse → resolve → commit → read back through the public readers.
 *
 *   npx tsx --env-file=.env.local scripts/verify-results-import.ts
 *
 * Runs against the live DB (no branch DB exists), so every row it creates is
 * prefixed / high-numbered and deleted by id at the end — including on failure.
 * It sends no email and touches no real registrations: fixture users are
 * `resfix-*`, fixture heats are numbered 91–92 on the fixture event, and the
 * event is not `completed`, so the public landing never renders these rows.
 */
import ExcelJS from "exceljs";
import { and, eq, inArray } from "drizzle-orm";

import { eventHeats, eventRegistrations, eventResults, users } from "../src/db/schema";
import {
  replaceHeatResults,
  resolveRegistrations,
} from "../src/features/admin/results-import/data";
import { parseResultsFile, parseTimeCs } from "../src/features/admin/results-import/parse";
import { getDb } from "../src/lib/db";
import { getEventBySlug } from "../src/lib/events/registry";
import { getDirectResultRefs, getMergedResults } from "../src/lib/events/results-data";
import { findUserResults } from "../src/lib/events/user-results";

const SLUG = "mile-2026-08-29";
const PREFIX = "resfix-";
const HEAT_A = 91;
const HEAT_B = 92;

let failures = 0;
function check(label: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok || detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  if (!ok) failures += 1;
}

/** The operator's CSV: semicolon-delimited, decimal commas, surname-first. */
const CSV = [
  "Heat;Bib;Place;Surname;First name;Sex;Time;Status",
  `${HEAT_A};5;1;Frostowicz;Łukasz;M;4:32,1;`,
  `${HEAT_A};7;2;Resfixova;Anna;F;4:45.23;`,
  `${HEAT_A};9;;Unknown;Zed;M;;DNF`,
  `${HEAT_B};5;1;Reused;Bib;M;5:01.00;`,
  `${HEAT_B};x;1;Broken;Row;M;5:10.00;`,
].join("\r\n");

async function xlsxFixture(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Results");
  sheet.addRow(["Some banner line the parser must skip"]);
  sheet.addRow(["Heat", "Bib", "Place", "Name", "Sex", "Time", "Status"]);
  sheet.addRow([HEAT_A, 5, 1, "Frostowicz Łukasz", "M", "4:32.10", ""]);
  sheet.addRow([HEAT_A, 7, 2, "Anna Resfixova", "F", "4:45.23", ""]);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

async function cleanup(heatIds: string[], userIds: string[]) {
  const db = getDb();
  await db
    .delete(eventResults)
    .where(
      and(eq(eventResults.eventSlug, SLUG), inArray(eventResults.heatNumber, [HEAT_A, HEAT_B])),
    );
  if (userIds.length > 0) {
    await db.delete(eventRegistrations).where(inArray(eventRegistrations.userId, userIds));
    await db.delete(users).where(inArray(users.id, userIds));
  }
  if (heatIds.length > 0) {
    await db.delete(eventHeats).where(inArray(eventHeats.id, heatIds));
  }
}

async function main() {
  const db = getDb();
  check("fixture event exists in registry", Boolean(getEventBySlug(SLUG)));

  // ---- time parsing, no DB needed ----
  check("parseTimeCs 4:32,1 (decimal comma, tenths)", parseTimeCs("4:32,1") === 27210);
  check("parseTimeCs 4:45.23", parseTimeCs("4:45.23") === 28523);
  check("parseTimeCs 1:04:32.15 (hours)", parseTimeCs("1:04:32.15") === 387215);
  check("parseTimeCs rejects 4:75.00", parseTimeCs("4:75.00") === null);

  const heatIds: string[] = [];
  const userIds = [`${PREFIX}lease`, `${PREFIX}name`];
  try {
    // ---- fixture: two heats, a leased bib, an unleased same-name runner ----
    const heats = await db
      .insert(eventHeats)
      .values([
        { eventSlug: SLUG, number: HEAT_A, capacity: 10, scheduledAt: new Date() },
        { eventSlug: SLUG, number: HEAT_B, capacity: 10, scheduledAt: new Date() },
      ])
      .returning({ id: eventHeats.id, number: eventHeats.number });
    heatIds.push(...heats.map((h) => h.id));
    const heatAId = heats.find((h) => h.number === HEAT_A)!.id;

    await db.insert(users).values([
      {
        id: `${PREFIX}lease`,
        name: "Łukasz Frostowicz",
        firstName: "Łukasz",
        lastName: "Frostowicz",
        email: `${PREFIX}lease@example.invalid`,
        sex: "M" as const,
      },
      {
        id: `${PREFIX}name`,
        name: "Anna Resfixova",
        firstName: "Anna",
        lastName: "Resfixova",
        email: `${PREFIX}name@example.invalid`,
        sex: "F" as const,
      },
    ]);
    const regs = await db
      .insert(eventRegistrations)
      .values([
        {
          eventSlug: SLUG,
          userId: `${PREFIX}lease`,
          status: "checked_in" as const,
          terms: true,
          heatId: heatAId,
          bib: 5,
          checkedInAt: new Date(),
        },
        // No bib, no heat: only the name can find this one.
        { eventSlug: SLUG, userId: `${PREFIX}name`, status: "confirmed" as const, terms: true },
      ])
      .returning({ id: eventRegistrations.id, userId: eventRegistrations.userId });
    const leaseRegId = regs.find((r) => r.userId === `${PREFIX}lease`)!.id;

    // ---- parse ----
    const csv = await parseResultsFile("results.csv", Buffer.from(CSV, "utf8"));
    check("csv: 4 rows parsed", csv.rows.length === 4, csv.rows.length);
    check("csv: 1 row refused (bad bib)", csv.errors.length === 1, csv.errors);
    check(
      "csv: surname-first columns joined",
      csv.rows[0]?.name === "Łukasz Frostowicz" || csv.rows[0]?.name === "Frostowicz Łukasz",
      csv.rows[0]?.name,
    );
    check("csv: dnf row has no time", csv.rows[2]?.status === "dnf" && csv.rows[2]?.timeCs === null);

    const xlsx = await parseResultsFile("results.xlsx", await xlsxFixture());
    check("xlsx: banner skipped, 2 rows parsed", xlsx.rows.length === 2 && xlsx.errors.length === 0, xlsx.errors);

    // ---- resolve ----
    const resolved = await resolveRegistrations(SLUG, csv.rows);
    const byBib = (heat: number, bib: number) => resolved.find((r) => r.heat === heat && r.bib === bib)!;
    check("resolve: (heat, bib) lease wins", byBib(HEAT_A, 5).matchedBy === "lease" && byBib(HEAT_A, 5).registrationId === leaseRegId);
    check("resolve: name fallback", byBib(HEAT_A, 7).matchedBy === "name");
    check("resolve: unknown runner unlinked", byBib(HEAT_A, 9).matchedBy === null);
    check("resolve: recycled bib in other heat unlinked", byBib(HEAT_B, 5).matchedBy === null);

    // ---- commit, twice (idempotence) ----
    const first = await replaceHeatResults(SLUG, resolved);
    check("commit: 4 rows across 2 heats", first.rows === 4 && first.heats === 2, first);
    await replaceHeatResults(SLUG, resolved);
    const stored = await db
      .select({ heatNumber: eventResults.heatNumber })
      .from(eventResults)
      .where(and(eq(eventResults.eventSlug, SLUG), inArray(eventResults.heatNumber, [HEAT_A, HEAT_B])));
    check("commit: re-import is idempotent", stored.length === 4, stored.length);

    // ---- readers ----
    const merged = await getMergedResults([SLUG]);
    const sheet = merged.get(SLUG);
    const entries = sheet?.heats.flatMap((h) => h.entries) ?? [];
    check("readers: DB sheet has finishers only (3 of 4)", entries.length === 3, entries.length);

    const refs = await getDirectResultRefs([leaseRegId]);
    check("readers: direct ref from lease", refs.get(SLUG)?.heatNumber === HEAT_A && refs.get(SLUG)?.bib === 5);

    const mine = findUserResults(
      "Łukasz Frostowicz",
      [{ eventSlug: SLUG, bib: 5 }],
      merged,
      refs,
    );
    check(
      "readers: profile match via direct ref, ranked 1st",
      mine.length === 1 && mine[0].rank === 1 && mine[0].entry.timeCs === 27210,
      mine[0],
    );

    // Config fallback still works for a never-imported event with a sheet.
    const legacy = await getMergedResults(["mile-2026-08-01"]);
    check(
      "readers: config-sheet fallback intact",
      (legacy.get("mile-2026-08-01")?.heats.length ?? 0) > 0,
    );
  } finally {
    await cleanup(heatIds, userIds);
    console.log("cleanup: fixture rows removed");
  }

  console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
