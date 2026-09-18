/**
 * One-off: put a price on the two paid October nights (ADR 0013).
 *
 *   npx tsx --env-file=.env.local scripts/price-autumn-nights.ts
 *   ALLOW_FIXTURES=1 npx tsx --env-file=.env.local scripts/price-autumn-nights.ts --apply
 *   ALLOW_FIXTURES=1 npx tsx --env-file=.env.local scripts/price-autumn-nights.ts --apply --force
 *
 * **Read-only by default.** The default mode prints the current fee column of
 * every event, what it would change, and the release condition below. `--apply`
 * is the only mode that writes and asks `requireFixtureConsent` first —
 * `DATABASE_URL` is the live database and there is no branch.
 *
 * Pricing is the switch that actually turns charging on, so this runs **after**
 * the charging code is merged, never before: an event row priced while the
 * register and enter paths still ignore the column shows a fee on the page that
 * nothing takes, and a row priced after they ship starts charging on the next
 * request. That ordering is the whole reason the price is a column and not a
 * constant (ADR 0005 — events are data): flipping it is an edit, not a deploy.
 *
 * ## What it touches
 *
 * Exactly {@link TARGET_SLUGS}: `mile-2026-10-01` and `mile-2026-10-10`, to 100
 * ACER per team entry and 5 ACER per individual entry. `mile-2026-09-22` stays
 * free and is printed alongside them as a check that it stayed that way — the
 * three autumn nights were seeded together and it is the one that is easy to
 * price by accident.
 *
 * ## What it refuses to do
 *
 * - **Overwrite a price somebody else set.** A row already at the target is
 *   reported and skipped. A row holding a *different* non-zero fee is reported
 *   with what it holds and left alone: `--force` is required to change it, per
 *   column. `0` is not a price, it is the absence of one, so a zero column is
 *   filled without a flag. A fee is charged at the moment of entry and recorded
 *   in the ledger row, so re-pricing never retro-charges or retro-refunds; that
 *   is precisely why a silent overwrite is the wrong default — the money
 *   already taken stays taken and only the next entrant notices.
 * - **Break the funnel.** `SIGNUP_GRANT_ACER` (5) is what a brand-new account
 *   is credited on creation, and it exactly covers one individual entry. If the
 *   highest `individual_entry_fee_acer` on any event ever exceeds it, a guest
 *   who signs up for that night cannot finish the flow they were shown. It
 *   cannot be a compile-time assertion once the price is a column, so it is
 *   checked here — over **every** event row, not just the two this script
 *   prices — and a breach refuses the write outright. `--force` does not
 *   override it; raising the grant, or lowering the fee, is the fix.
 * - **Price a night that does not exist.** A missing slug is an error, not an
 *   insert: creating an event is `seed-mixed-nights-autumn-2026.ts`'s job and
 *   the admin form's, and a typo'd slug here must fail loudly rather than
 *   conjure a race.
 *
 * Idempotent: a second `--apply` reports both rows as already priced and writes
 * nothing. The committed state is re-read from the database after the write and
 * printed, so the run's last word is what the rows actually hold rather than
 * what the script believes it set.
 */
import { eq, inArray } from "drizzle-orm";

import { events } from "../src/db/schema";
import { SIGNUP_GRANT_ACER } from "../src/features/wallet/config";
import { getDb } from "../src/lib/db";
import { requireFixtureConsent } from "./lib/guard";

const APPLY = process.argv.includes("--apply");
const FORCE = process.argv.includes("--force");

if (APPLY) requireFixtureConsent("scripts/price-autumn-nights.ts");

/** The two nights that stop being free, and nothing else. */
const TARGET_SLUGS = ["mile-2026-10-01", "mile-2026-10-10"] as const;

/** Printed beside the targets as a check that it stayed free. Never written to. */
const STAYS_FREE = "mile-2026-09-22";

const TEAM_FEE_ACER = 100;
const INDIVIDUAL_FEE_ACER = 5;

type FeeRow = {
  slug: string;
  name: string;
  date: string;
  status: string;
  teamEntryFeeAcer: number;
  individualEntryFeeAcer: number;
};

/** What this script decided about one target row. */
type Verdict =
  | { kind: "missing"; slug: string }
  | { kind: "unchanged"; row: FeeRow }
  | { kind: "price"; row: FeeRow }
  | { kind: "blocked"; row: FeeRow; why: string[] };

function line(text = ""): void {
  console.log(text);
}

function feeLine(row: FeeRow): string {
  return (
    `  ${row.slug.padEnd(18)} ${row.date}  ${row.status.padEnd(18)}` +
    `  team ${String(row.teamEntryFeeAcer).padStart(4)}  individual ${String(row.individualEntryFeeAcer).padStart(4)}`
  );
}

async function readFees(db: ReturnType<typeof getDb>): Promise<FeeRow[]> {
  return db
    .select({
      slug: events.slug,
      name: events.name,
      date: events.date,
      status: events.status,
      teamEntryFeeAcer: events.teamEntryFeeAcer,
      individualEntryFeeAcer: events.individualEntryFeeAcer,
    })
    .from(events)
    .orderBy(events.date);
}

/**
 * Whether one column may be written. A zero is the absence of a price and is
 * filled freely; a different non-zero price was set by somebody on purpose.
 */
function blockedColumn(label: string, current: number, next: number): string | null {
  if (current === 0 || current === next || FORCE) return null;
  return `${label} already holds ${current} ACER (target ${next}) — re-run with --force to change it`;
}

async function main() {
  const db = getDb();
  const host = new URL(process.env.DATABASE_URL ?? "postgres://unset/").hostname;
  line(
    `${APPLY ? "APPLY (writes)" : "read-only (writes nothing)"} against ${host}` +
      `${FORCE ? " — --force: an existing different price may be overwritten" : ""}`,
  );

  // The constant itself is checked before any row is read: shipping a script
  // whose target fee already breaks the funnel is a bug in the script.
  if (INDIVIDUAL_FEE_ACER > SIGNUP_GRANT_ACER) {
    console.error(
      `REFUSING: the target individual fee (${INDIVIDUAL_FEE_ACER} ACER) exceeds ` +
        `SIGNUP_GRANT_ACER (${SIGNUP_GRANT_ACER}). A guest who signs up could not finish registering.`,
    );
    process.exit(1);
  }

  const before = await readFees(db);
  line();
  line(`Fee columns today — all ${before.length} event rows`);
  for (const row of before) {
    const mark =
      TARGET_SLUGS.includes(row.slug as (typeof TARGET_SLUGS)[number]) || row.slug === STAYS_FREE
        ? "*"
        : " ";
    line(`${mark}${feeLine(row).slice(1)}`);
  }
  line("  (* the three autumn nights)");

  const bySlug = new Map(before.map((row) => [row.slug, row]));

  const freeNight = bySlug.get(STAYS_FREE);
  line();
  if (!freeNight) {
    line(`${STAYS_FREE}: no such event row — nothing to check.`);
  } else if (freeNight.teamEntryFeeAcer === 0 && freeNight.individualEntryFeeAcer === 0) {
    line(`${STAYS_FREE}: still free (0/0), as decided. Not touched by this script.`);
  } else {
    line(
      `${STAYS_FREE}: WARNING — decided to stay free, but holds ` +
        `team ${freeNight.teamEntryFeeAcer} / individual ${freeNight.individualEntryFeeAcer} ACER. ` +
        `This script does not change it; somebody else priced it.`,
    );
  }

  const verdicts: Verdict[] = TARGET_SLUGS.map((slug): Verdict => {
    const row = bySlug.get(slug);
    if (!row) return { kind: "missing", slug };
    if (
      row.teamEntryFeeAcer === TEAM_FEE_ACER &&
      row.individualEntryFeeAcer === INDIVIDUAL_FEE_ACER
    ) {
      return { kind: "unchanged", row };
    }
    const why = [
      blockedColumn("team_entry_fee_acer", row.teamEntryFeeAcer, TEAM_FEE_ACER),
      blockedColumn("individual_entry_fee_acer", row.individualEntryFeeAcer, INDIVIDUAL_FEE_ACER),
    ].filter((reason): reason is string => reason !== null);
    return why.length > 0 ? { kind: "blocked", row, why } : { kind: "price", row };
  });

  line();
  line(
    `Plan for the two paid nights — target team ${TEAM_FEE_ACER} / individual ${INDIVIDUAL_FEE_ACER} ACER`,
  );
  for (const verdict of verdicts) {
    switch (verdict.kind) {
      case "missing":
        line(`  ${verdict.slug.padEnd(18)} MISSING — no event row with that slug`);
        break;
      case "unchanged":
        line(
          `  ${verdict.row.slug.padEnd(18)} already priced ` +
            `(team ${verdict.row.teamEntryFeeAcer} / individual ${verdict.row.individualEntryFeeAcer}) — skipped`,
        );
        break;
      case "price":
        line(
          `  ${verdict.row.slug.padEnd(18)} ` +
            `team ${verdict.row.teamEntryFeeAcer} → ${TEAM_FEE_ACER}, ` +
            `individual ${verdict.row.individualEntryFeeAcer} → ${INDIVIDUAL_FEE_ACER}`,
        );
        break;
      case "blocked":
        line(`  ${verdict.row.slug.padEnd(18)} NOT CHANGED:`);
        for (const why of verdict.why) line(`      ${why}`);
        break;
    }
  }

  // ------------------------------------------------- the release condition

  // Computed over the state this run would leave behind, not the state it found:
  // the point is to refuse *before* writing a price that breaks the funnel.
  const wouldPrice = new Set(
    verdicts.filter((verdict) => verdict.kind === "price").map((verdict) => verdict.row.slug),
  );
  const after = before.map((row) => ({
    slug: row.slug,
    individual: wouldPrice.has(row.slug) ? INDIVIDUAL_FEE_ACER : row.individualEntryFeeAcer,
  }));
  const highest = after.reduce((worst, row) => (row.individual > worst.individual ? row : worst), {
    slug: "—",
    individual: 0,
  });

  line();
  line("Release condition — SIGNUP_GRANT_ACER >= individual_entry_fee_acer on every night");
  line(`  SIGNUP_GRANT_ACER                   ${SIGNUP_GRANT_ACER}`);
  line(
    `  highest individual fee after this   ${highest.individual}` +
      `${highest.individual > 0 ? ` (${highest.slug})` : ""}`,
  );
  const releaseOk = highest.individual <= SIGNUP_GRANT_ACER;
  line(
    `  ${releaseOk ? "OK" : "BROKEN"} — a guest who signs up ${releaseOk ? "can" : "CANNOT"} finish registering for that night`,
  );

  const blocked = verdicts.filter((verdict) => verdict.kind === "blocked");
  const missing = verdicts.filter((verdict) => verdict.kind === "missing");

  if (!APPLY) {
    line();
    if (!releaseOk) {
      line("Read-only — and this plan would break the release condition. It would be refused.");
    } else if (wouldPrice.size === 0) {
      line("Read-only — nothing to change. Both nights are already at the target price.");
    } else {
      line(`Read-only — nothing was written. Re-run to price ${wouldPrice.size} row(s):`);
      line(
        "  ALLOW_FIXTURES=1 npx tsx --env-file=.env.local scripts/price-autumn-nights.ts --apply",
      );
    }
    process.exit(missing.length > 0 || blocked.length > 0 ? 1 : 0);
  }

  if (!releaseOk) {
    console.error(
      `\nREFUSING TO WRITE: the highest individual entry fee would be ${highest.individual} ACER ` +
        `(${highest.slug}) against a signup grant of ${SIGNUP_GRANT_ACER}. --force does not ` +
        `override this; raise the grant or lower the fee.`,
    );
    process.exit(1);
  }

  if (missing.length > 0) {
    console.error(
      `\nREFUSING TO WRITE: ${missing.map((verdict) => verdict.slug).join(", ")} has no event row. ` +
        `Seed the night first (scripts/seed-mixed-nights-autumn-2026.ts), or fix the slug.`,
    );
    process.exit(1);
  }

  // ------------------------------------------------------------- the write

  let written = 0;
  for (const verdict of verdicts) {
    if (verdict.kind !== "price") continue;
    // `updated_at` is bumped: pricing a night *is* an edit to the event, and the
    // admin list orders and dates rows by it.
    await db
      .update(events)
      .set({
        teamEntryFeeAcer: TEAM_FEE_ACER,
        individualEntryFeeAcer: INDIVIDUAL_FEE_ACER,
        updatedAt: new Date(),
      })
      .where(eq(events.slug, verdict.row.slug));
    written += 1;
  }

  // Re-read rather than trust the update: the run's last word should be what the
  // database holds, not what this script believes it set.
  const committed = await db
    .select({
      slug: events.slug,
      name: events.name,
      date: events.date,
      status: events.status,
      teamEntryFeeAcer: events.teamEntryFeeAcer,
      individualEntryFeeAcer: events.individualEntryFeeAcer,
    })
    .from(events)
    .where(inArray(events.slug, [...TARGET_SLUGS, STAYS_FREE]))
    .orderBy(events.date);

  line();
  line(`Wrote ${written} row(s). Committed state, re-read:`);
  for (const row of committed) line(feeLine(row));

  if (blocked.length > 0) {
    console.error(
      `\n${blocked.length} row(s) were left alone because they hold a different price. ` +
        `Re-run with --force only if replacing it is what you mean.`,
    );
    process.exit(1);
  }
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
