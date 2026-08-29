/**
 * One-off: import the real timing export for mile-2026-08-29 and close the
 * event (status → completed). Same code path as the admin Results tab
 * (parseResultsFile → resolveRegistrations → replaceHeatResults), minus the
 * session and the revalidatePath calls — the public surfaces self-heal via
 * their `revalidate = 300` safety net.
 *
 * Dry-run by default (prints the full preview, writes nothing):
 *
 *   npx tsx --env-file=.env.local scripts/import-0829-results.ts <file.xlsx>
 *   npx tsx --env-file=.env.local scripts/import-0829-results.ts <file.xlsx> --write
 */
import { readFileSync } from "node:fs";
import { basename } from "node:path";

import { eq } from "drizzle-orm";

import { events } from "../src/db/schema";
import {
  replaceHeatResults,
  resolveRegistrations,
  unknownHeatNumbers,
} from "../src/features/admin/results-import/data";
import { parseResultsFile } from "../src/features/admin/results-import/parse";
import { getDb } from "../src/lib/db";
import { getEventBySlug } from "../src/lib/events/store";
import { formatTime } from "../src/lib/events/time";

const SLUG = "mile-2026-08-29";
const WRITE = process.argv.includes("--write");
const filePath = process.argv[2];

async function main() {
  if (!filePath || filePath.startsWith("--")) {
    console.error("Usage: tsx scripts/import-0829-results.ts <results file> [--write]");
    process.exit(1);
  }

  const host = new URL(process.env.DATABASE_URL ?? "postgres://unset/").hostname;
  console.log(`${WRITE ? "WRITE" : "dry-run"} against ${host}, event ${SLUG}`);

  const event = await getEventBySlug(SLUG);
  if (!event) throw new Error(`No event row for ${SLUG}`);
  console.log(`Event: ${event.name ?? SLUG} — status "${event.status}"`);

  const buffer = readFileSync(filePath);
  const parsed = await parseResultsFile(basename(filePath), buffer);
  if (parsed.rows.length === 0) {
    console.error("No parseable rows.");
    for (const e of parsed.errors) console.error(`  row ${e.sourceRow}: ${e.message}`);
    process.exit(1);
  }

  const rows = await resolveRegistrations(SLUG, parsed.rows);
  const heatNumbers = [...new Set(rows.map((r) => r.heat))].sort((a, b) => a - b);
  const unknown = await unknownHeatNumbers(SLUG, heatNumbers);

  console.log(`\nParsed ${rows.length} rows across heats ${heatNumbers.join(", ")}`);
  for (const r of rows
    .slice()
    .sort((a, b) => a.heat - b.heat || (a.place ?? Infinity) - (b.place ?? Infinity))) {
    console.log(
      `  heat ${r.heat}  bib ${String(r.bib).padStart(3)}  ` +
        `${r.status === "finished" ? `#${r.place} ${formatTime(r.timeCs as number)}` : r.status.toUpperCase()}  ` +
        `${r.name} (${r.gender})  [${r.matchedBy ?? "UNLINKED"}]`,
    );
  }

  const linked = rows.filter((r) => r.registrationId !== null).length;
  console.log(`\nLinked to registrations: ${linked}/${rows.length}`);
  if (unknown.length > 0) console.log(`Heats with no event_heats row: ${unknown.join(", ")}`);
  if (parsed.errors.length > 0) {
    console.log(`Rows the parser refused (would be skipped):`);
    for (const e of parsed.errors) console.log(`  row ${e.sourceRow}: ${e.message}`);
  }

  if (!WRITE) {
    console.log("\nDry-run complete — nothing written. Re-run with --write to import.");
    process.exit(0);
  }

  const outcome = await replaceHeatResults(SLUG, rows);
  console.log(`\nImported ${outcome.rows} rows into ${outcome.heats} heats.`);

  if (event.status === "completed") {
    console.log("Event already completed — status untouched.");
  } else {
    await getDb()
      .update(events)
      .set({ status: "completed", updatedAt: new Date() })
      .where(eq(events.slug, SLUG));
    console.log(`Event status: "${event.status}" → "completed".`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
