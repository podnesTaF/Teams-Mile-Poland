/**
 * Throwaway, READ-ONLY check of the heat-export slice (#33). NOT committed.
 *
 *   npx tsx --env-file=.env.local scripts/verify-heat-export.ts [slug]
 *
 * Runs against whatever `DATABASE_URL` `.env.local` points at (the live DB — no
 * Neon branch here). It only SELECTs: it builds the export workbook for an event
 * and parses the bytes back to assert the sheet set, the generation stamp and the
 * bib pass-through. No writes, no mail transport imported.
 */
import ExcelJS from "exceljs";
import { and, eq, isNotNull, sql } from "drizzle-orm";

import { eventHeats, eventRegistrations } from "../src/db/schema";
import { getDb } from "../src/lib/db";
import { buildHeatExportWorkbook, heatExportFilename } from "../src/features/admin/heat-export";

let failures = 0;
function ok(label: string, pass: boolean, detail = ""): void {
  console.log(`${pass ? "  ok  " : " FAIL "} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!pass) failures += 1;
}

/** An event slug that has at least one heat, preferring one with registrations. */
async function pickSlug(): Promise<string | null> {
  const db = getDb();
  const [row] = await db
    .select({
      slug: eventHeats.eventSlug,
      heats: sql<number>`count(distinct ${eventHeats.id})::int`,
    })
    .from(eventHeats)
    .groupBy(eventHeats.eventSlug)
    .orderBy(sql`count(distinct ${eventHeats.id}) desc`)
    .limit(1);
  return row?.slug ?? null;
}

async function main(): Promise<void> {
  const slug = process.argv[2] ?? (await pickSlug());
  if (!slug) {
    console.log("No event with heats found — seed one first, or pass a slug.");
    process.exit(0);
  }
  const db = getDb();
  const heatRows = await db.select().from(eventHeats).where(eq(eventHeats.eventSlug, slug));
  const [{ regs }] = await db
    .select({ regs: sql<number>`count(*)::int` })
    .from(eventRegistrations)
    .where(eq(eventRegistrations.eventSlug, slug));
  const [{ bibbed }] = await db
    .select({ bibbed: sql<number>`count(*)::int` })
    .from(eventRegistrations)
    .where(and(eq(eventRegistrations.eventSlug, slug), isNotNull(eventRegistrations.bib)));

  console.log(`\nEvent ${slug}: ${heatRows.length} heats, ${regs} registrations, ${bibbed} bibbed\n`);

  const buffer = await buildHeatExportWorkbook(slug);
  ok("workbook is non-empty", buffer.length > 0, `${buffer.length} bytes`);

  const wb = new ExcelJS.Workbook();
  // exceljs declares its own `interface Buffer extends ArrayBuffer` (index.d.ts:1),
  // so `load()` wants an ArrayBuffer, not Node's Buffer — hand it one. (jszip
  // underneath takes either; `heat-export.ts` crosses the same gap the other way
  // with `Buffer.from(await writeBuffer())`.)
  await wb.xlsx.load(new Uint8Array(buffer).buffer);
  const names = wb.worksheets.map((w) => w.name);
  console.log(`  sheets: ${names.join(", ")}\n`);

  // AC: flat sheet, one per heat, an Unassigned sheet.
  ok("Flat sheet is first (opens by default)", names[0] === "Flat");
  ok("Unassigned sheet present", names.includes("Unassigned"));
  for (const h of heatRows) {
    ok(`per-heat sheet "Heat ${h.number}"`, names.includes(`Heat ${h.number}`));
  }
  ok(
    "sheet count = 1 flat + N heats + 1 unassigned",
    names.length === heatRows.length + 2,
    `${names.length} vs ${heatRows.length + 2}`,
  );

  // AC: generation timestamp present in the workbook.
  const flat = wb.getWorksheet("Flat")!;
  const banner = String(flat.getCell(1, 1).value ?? "");
  ok("generation stamp in banner", /Generated .+ Warsaw/.test(banner), banner);
  ok("workbook.created metadata set", wb.created instanceof Date);

  // Header row shape (row 2 after the banner).
  const headers = (flat.getRow(2).values as unknown[]).filter(Boolean).map(String);
  const wantFlat = ["Heat", "Start", "Bib", "First name", "Surname", "Sex", "Club", "Status", "Checked in"];
  ok("flat headers match", wantFlat.every((h) => headers.includes(h)), headers.join("|"));

  // Flat data rows = every registration.
  const flatDataRows = flat.rowCount - 2;
  ok("flat sheet has a row per registration", flatDataRows === regs, `${flatDataRows} vs ${regs}`);

  // AC: bib is blank before check-in, populated after. We do not mutate — we
  // assert the pass-through: the count of non-empty Bib cells equals the count of
  // bibbed registrations in the DB (0 before any check-in, N after).
  const bibCol = wantFlat.indexOf("Bib") + 1;
  let nonEmptyBibs = 0;
  for (let r = 3; r <= flat.rowCount; r += 1) {
    const v = flat.getCell(r, bibCol).value;
    if (v !== null && v !== undefined && v !== "") nonEmptyBibs += 1;
  }
  ok(
    "bib cells reflect leases (blank when unleased)",
    nonEmptyBibs === bibbed,
    `${nonEmptyBibs} filled vs ${bibbed} bibbed in DB`,
  );

  console.log(`\n  filename: ${heatExportFilename(slug)}`);
  console.log(`\n${failures === 0 ? "ALL PASS" : `${failures} FAILED`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
