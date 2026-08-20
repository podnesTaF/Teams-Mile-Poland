/**
 * One-off backfill: push the hand-entered config result sheets into
 * `event_results` through the same resolve/commit pipeline the admin import
 * uses, so legacy events are queryable like imported ones and the config
 * fallback can eventually be retired.
 *
 *   npx tsx --env-file=.env.local scripts/backfill-config-results.ts
 *
 * Idempotent: `replaceHeatResults` replaces whole heats, so re-running lands
 * the same rows. Linking follows the import's rules — (heat, bib) lease first,
 * unique name match second, unlinked otherwise (warsaw-2026 predates
 * event_registrations, so its rows stay unlinked and keep matching profiles at
 * read time by name, exactly as before).
 */
import {
  replaceHeatResults,
  resolveRegistrations,
} from "../src/features/admin/results-import/data";
import type { ParsedResultRow } from "../src/features/admin/results-import/parse";
import { RESULTS_SHEETS } from "../src/lib/events/results-sheets";

const SLUGS = ["warsaw-2026", "mile-2026-08-01"];

async function backfill(slug: string) {
  const results = RESULTS_SHEETS[slug];
  if (!results) {
    console.log(`${slug}: no config sheet — skipped`);
    return;
  }

  const rows: ParsedResultRow[] = results.heats.flatMap((heat) =>
    heat.entries.map((entry, i) => ({
      sourceRow: i + 1,
      heat: heat.number,
      bib: entry.bib,
      status: "finished" as const,
      timeCs: entry.timeCs,
      place: entry.place,
      name: entry.name,
      gender: entry.gender,
    })),
  );

  const resolved = await resolveRegistrations(slug, rows);
  const { heats, rows: written } = await replaceHeatResults(slug, resolved);
  const linked = resolved.filter((r) => r.registrationId !== null).length;
  console.log(
    `${slug}: ${written} rows across ${heats} heats — ${linked} linked, ${written - linked} unlinked`,
  );
}

async function main() {
  for (const slug of SLUGS) await backfill(slug);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
