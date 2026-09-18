/**
 * One-off: bring every race actually run up to {@link PARTICIPATION_REWARD_ACER}
 * ACER, including the races run before anything paid for them.
 *
 *   npx tsx --env-file=.env.local scripts/backfill-participation-rewards.ts
 *   ALLOW_FIXTURES=1 npx tsx --env-file=.env.local \
 *     scripts/backfill-participation-rewards.ts --apply --skip-non-starters
 *   ALLOW_FIXTURES=1 npx tsx --env-file=.env.local \
 *     scripts/backfill-participation-rewards.ts --apply --pay-non-starters
 *
 * `--only <slug>` (repeatable) narrows every table and every write to one night.
 * Omitted, it runs over all of them, which is the run that matters; it exists so
 * the whole path can be exercised against a fixture night without crediting real
 * accounts, and so the real run can be taken one night at a time.
 *
 * **Dry-run by default.** The default mode is a grouped read and prints exactly
 * what `--apply` would write — the per-event split, the grand total, the source
 * split, and every result row it could not resolve to an account. `--apply` is
 * the only mode that touches the ledger, and it asks `requireFixtureConsent`
 * first because `DATABASE_URL` is the live database and there is no branch.
 *
 * Reverses the 2026-08-20 "no backfill" decision recorded in the header of
 * `src/features/wallet/accruals.ts`: the participation reward went 1 → 5 ACER
 * (planning/event-entry-fees), and past runners are topped up to 5 rather than
 * handed a second 5. Everybody ends at exactly 5 per race run, whenever they ran.
 *
 * ## Why "participated" is wider here than in `lib/events/participation.ts`
 *
 * Read this before "fixing" the predicate back. `src/lib/events/participation.ts`
 * defines a participation as a `checked_in` registration (plus a legacy
 * `attended` row), and that definition is correct for what it was written for.
 * But **the desk never used check-in.** Across the four completed mile nights
 * the registrations sit at `registered` and `confirmed`; there is exactly **one**
 * `checked_in` row in the entire series. Attendance was recorded by importing
 * the timing system's results instead — `event_results`, linked back to a
 * registration by its (heat, bib) lease at import time.
 *
 * So a backfill keyed on `RAN_SERIES_RACE` would credit one person. Here a
 * participation is the **union** of three sources, de-duplicated to distinct
 * (user, event) pairs:
 *
 *   1. an `event_results` row whose `registration_id` resolves to a user — the
 *      primary evidence that somebody stood on the start line;
 *   2. an `event_registrations` row at `checked_in` — the ongoing accrual's own
 *      rule, kept so the two definitions agree wherever the desk did use it;
 *   3. a `legacy_participations` row with `attended = true` — the `warsaw-2026`
 *      import, whose runners predate the `users` table's registrations.
 *
 * That union lives **in this script and nowhere else**. It deliberately does not
 * edit `lib/events/participation.ts`: the profile's "races run" counter, the
 * admin users list and the referral funnels all read that module, and quietly
 * widening it would restate three surfaces' numbers as a side effect of a
 * one-off grant. Widening the canonical definition is its own change with its
 * own review.
 *
 * ## Non-starters, and why `--apply` will not choose for you
 *
 * A result row carries a `status`, and the plan's count of "131 linked pairs"
 * was taken before anyone looked at it. On the live data, **44 of those 131
 * pairs are evidenced only by `dns` rows** — did not start. The timing export
 * lists everyone on the heat sheet, so a runner who never appeared comes back as
 * a result row all the same: for those pairs the result row is positive evidence
 * of *absence*, and crediting them pays 5 ACER for not turning up. `dnf` is the
 * opposite case and counts as run: they started.
 *
 * This script will not decide that. `--apply` refuses unless the operator says
 * which it is — `--skip-non-starters` (credit only pairs with evidence of
 * starting) or `--pay-non-starters` (the plan's literal union). The dry run
 * prints both totals. Skipping is the recoverable direction: a pair left out
 * today is credited by a later run under the same key, whereas the ledger is
 * append-only and an ACER paid in error costs an admin `reversal` row.
 *
 * ## What else it refuses to do
 *
 * - **Name-match.** Some result rows carry no `registration_id` (the known
 *   walk-ups and spelling mismatches from the 08-22 and 08-29 imports). They are
 *   printed by event, heat, bib and the name on the timing sheet, and left
 *   alone. A name match that is wrong pays a stranger; resolving them is a data
 *   decision for the owner, not this script's.
 * - **Pay twice.** A pair already carrying `participation:<registrationId>` is
 *   topped up by the *difference* only, under `participation_topup:<id>`. A
 *   difference of zero or less writes nothing at all.
 * - **Insert directly.** Every row goes through `recordWalletTransaction`, the
 *   ledger's only writer. `null` back from it means the causing fact is already
 *   recorded, which is a success, not a failure.
 * - **Remember anything.** Re-running `--apply` writes nothing the second time
 *   because of the idempotency keys below, not because of a flag stored
 *   anywhere. There is no "done" marker to lose.
 *
 * ## The keys
 *
 * - no existing row → the full reward under the **canonical**
 *   `participation:<registrationId>`. Canonical deliberately: if that
 *   registration is ever checked in later, `awardCheckInRewards` finds the fact
 *   already recorded and does not pay a second time.
 * - an existing row → the shortfall under `participation_topup:<registrationId>`,
 *   which is a separate fact (the re-pricing) from the original credit.
 * - a legacy pair has no registration id → `participation_legacy:<userId>:<slug>`.
 *
 * One consequence of keying the top-up per registration: it can be written once.
 * If the reward is ever raised again, that second raise needs a key of its own —
 * this script's top-up key would collide and silently no-op. Say so in the new
 * script rather than reusing this one.
 *
 * `reference` follows the `eventReference` convention in `accruals.ts`
 * (`event:<slug>`) and `memo` stays null for the reason that file's docblock
 * gives: a memo is stored once and read in whatever language its owner reads
 * the site in, so any sentence put there is an untranslatable string on the
 * money screen. The `kind` label is already translated in all three catalogs.
 */
import { eq, inArray, like } from "drizzle-orm";

import {
  eventRegistrations,
  eventResults,
  legacyParticipations,
  walletTransactions,
} from "../src/db/schema";
import { PARTICIPATION_REWARD_ACER, acerToMinor, minorToAcer } from "../src/features/wallet/config";
import { recordWalletTransaction } from "../src/features/wallet/data";
import { getDb } from "../src/lib/db";
import { requireFixtureConsent } from "./lib/guard";

const APPLY = process.argv.includes("--apply");
const PAY_NON_STARTERS = process.argv.includes("--pay-non-starters");
const SKIP_NON_STARTERS = process.argv.includes("--skip-non-starters");

/**
 * `--only <slug>`, repeatable: narrow every table and every write to those
 * events. Empty means all of them, which is the run that matters. It exists so
 * the script can be proven end-to-end against one fixture night without
 * crediting 144 real accounts, and so the real run can go one night at a time.
 */
const ONLY = new Set(
  process.argv.flatMap((arg, index) => {
    if (arg.startsWith("--only=")) return [arg.slice("--only=".length)];
    if (arg !== "--only") return [];
    const next = process.argv[index + 1];
    return next && !next.startsWith("--") ? [next] : [];
  }),
);

const inScope = (eventSlug: string) => ONLY.size === 0 || ONLY.has(eventSlug);

if (APPLY) {
  if (PAY_NON_STARTERS === SKIP_NON_STARTERS) {
    console.error(
      "REFUSING TO RUN: --apply needs an explicit decision about non-starters.\n" +
        "  Some linked (user, event) pairs are evidenced only by `dns` result rows — the timing\n" +
        "  export lists everyone on the heat sheet, so those runners did not start. The dry run\n" +
        "  prints how many, and what each choice costs. Run it first, then pick one:\n" +
        "    --skip-non-starters   credit only pairs with evidence of starting (recoverable)\n" +
        "    --pay-non-starters    credit the plan's literal union, dns included",
    );
    process.exit(1);
  }
  requireFixtureConsent("scripts/backfill-participation-rewards.ts");
}

/** What one race run must be worth when this script is done, in minor units. */
const TARGET_MINOR = acerToMinor(PARTICIPATION_REWARD_ACER);

/** Which of the three sources evidenced a pair. Printed, never used to decide the key. */
type Source = "result" | "checked_in" | "legacy";

/** One distinct (user, event) participation, whatever evidenced it. */
type Pair = {
  userId: string;
  eventSlug: string;
  /** Null only for a legacy pair — `legacy_participations` has no registration. */
  registrationId: string | null;
  sources: Set<Source>;
  /**
   * Evidence that they were actually on the start line: any result row that is
   * not `dns`, or a check-in, or a legacy `attended` row. False means every
   * scrap of evidence for this pair says "did not start".
   */
  started: boolean;
};

/** A result row the import could not tie to an account. Reported, never guessed at. */
type Orphan = {
  eventSlug: string;
  heatNumber: number;
  bib: number;
  name: string;
  status: string;
};

/** What this script decided to do about one pair. */
type Plan =
  | { action: "full"; pair: Pair; key: string; amountMinor: number }
  | { action: "topup"; pair: Pair; key: string; amountMinor: number; heldMinor: number }
  | { action: "settled"; pair: Pair; heldMinor: number }
  | { action: "skipped"; pair: Pair; why: string }
  | { action: "anomaly"; pair: Pair; why: string };

type Action = Plan["action"];

const participationKey = (registrationId: string) => `participation:${registrationId}`;
const topupKey = (registrationId: string) => `participation_topup:${registrationId}`;
const legacyKey = (userId: string, eventSlug: string) =>
  `participation_legacy:${userId}:${eventSlug}`;

/** See `eventReference` in `src/features/wallet/accruals.ts` — same convention, same shape. */
const eventReference = (eventSlug: string) => `event:${eventSlug}`;

const pairId = (userId: string, eventSlug: string) => `${userId} ${eventSlug}`;

function line(text = ""): void {
  console.log(text);
}

/** Whole ACER with two decimals only when it needs them, for the money columns. */
function acer(amountMinor: number): string {
  const value = minorToAcer(amountMinor);
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

async function main() {
  const db = getDb();
  const host = new URL(process.env.DATABASE_URL ?? "postgres://unset/").hostname;
  const nonStarterMode = APPLY ? (PAY_NON_STARTERS ? "pay" : "skip") : "both reported";
  line(
    `${APPLY ? "APPLY (writes)" : "dry-run (writes nothing)"} against ${host} — ` +
      `target ${PARTICIPATION_REWARD_ACER} ACER per race run, non-starters: ${nonStarterMode}`,
  );
  if (ONLY.size > 0) line(`  --only: ${[...ONLY].join(", ")} — every other night is out of scope`);

  // ---------------------------------------------------------------- sources

  const pairs = new Map<string, Pair>();
  const orphans: Orphan[] = [];
  const mismatched: string[] = [];

  function note(
    userId: string,
    eventSlug: string,
    registrationId: string | null,
    source: Source,
    started: boolean,
  ) {
    const id = pairId(userId, eventSlug);
    const existing = pairs.get(id);
    if (existing) {
      existing.sources.add(source);
      existing.started ||= started;
      // A (user, event) pair has at most one registration — the unique index on
      // (event_slug, user_id) says so — but a legacy pair arrives with none, so
      // the first id seen wins and a later null never erases it.
      existing.registrationId ??= registrationId;
      return;
    }
    pairs.set(id, { userId, eventSlug, registrationId, sources: new Set([source]), started });
  }

  // 1. Results. The primary evidence: someone crossed the line, and the import
  //    tied their (heat, bib) lease back to a registration.
  const resultRows = (
    await db
      .select({
        eventSlug: eventResults.eventSlug,
        heatNumber: eventResults.heatNumber,
        bib: eventResults.bib,
        name: eventResults.name,
        status: eventResults.status,
        registrationId: eventResults.registrationId,
        regUserId: eventRegistrations.userId,
        regEventSlug: eventRegistrations.eventSlug,
      })
      .from(eventResults)
      .leftJoin(eventRegistrations, eq(eventRegistrations.id, eventResults.registrationId))
  ).filter((row) => inScope(row.eventSlug));

  const resultStatusCount = new Map<string, number>();
  for (const row of resultRows) {
    resultStatusCount.set(row.status, (resultStatusCount.get(row.status) ?? 0) + 1);
    if (!row.registrationId || !row.regUserId) {
      orphans.push({
        eventSlug: row.eventSlug,
        heatNumber: row.heatNumber,
        bib: row.bib,
        name: row.name,
        status: row.status,
      });
      continue;
    }
    // A result linked to a registration for a *different* night would be an
    // import bug, and paying it would credit the wrong race. Report, never pay.
    if (row.regEventSlug !== row.eventSlug) {
      mismatched.push(
        `${row.eventSlug} heat ${row.heatNumber} bib ${row.bib} (${row.name}) ` +
          `→ registration on ${row.regEventSlug}`,
      );
      continue;
    }
    note(row.regUserId, row.eventSlug, row.registrationId, "result", row.status !== "dns");
  }
  const resultPairs = pairs.size;

  // 2. Checked-in registrations — one row in the whole series, and the rule the
  //    live accrual still uses. Kept so the two definitions agree where it was used.
  const checkedIn = (
    await db
      .select({
        id: eventRegistrations.id,
        eventSlug: eventRegistrations.eventSlug,
        userId: eventRegistrations.userId,
      })
      .from(eventRegistrations)
      .where(eq(eventRegistrations.status, "checked_in"))
  ).filter((row) => inScope(row.eventSlug));
  for (const row of checkedIn) note(row.userId, row.eventSlug, row.id, "checked_in", true);

  // 3. Legacy attendance — the warsaw-2026 import, whose runners predate the
  //    series' registrations entirely.
  const legacy = (
    await db
      .select({ userId: legacyParticipations.userId, eventSlug: legacyParticipations.eventSlug })
      .from(legacyParticipations)
      .where(eq(legacyParticipations.attended, true))
  ).filter((row) => inScope(row.eventSlug));
  for (const row of legacy) note(row.userId, row.eventSlug, null, "legacy", true);

  const all = [...pairs.values()];

  // ------------------------------------------------------- what is already paid

  // A grouped read of the ledger rather than one lookup per pair. Reading the
  // table directly is fine — `recordWalletTransaction` is the single *writer*;
  // there is no single-reader rule, and the owner-scoped
  // `getWalletTransactionByKey` is the wrong shape for 300 keys at once.
  const wanted: string[] = [];
  for (const pair of all) {
    if (pair.registrationId) {
      wanted.push(participationKey(pair.registrationId), topupKey(pair.registrationId));
    } else {
      wanted.push(legacyKey(pair.userId, pair.eventSlug));
    }
  }

  const held =
    wanted.length === 0
      ? []
      : await db
          .select({
            key: walletTransactions.idempotencyKey,
            userId: walletTransactions.userId,
            amountMinor: walletTransactions.amountMinor,
            status: walletTransactions.status,
          })
          .from(walletTransactions)
          .where(inArray(walletTransactions.idempotencyKey, wanted));

  const ledger = new Map(held.map((row) => [row.key as string, row]));

  /** What a key is worth toward the target. Only `completed` rows count toward a balance. */
  function worth(key: string): number {
    const row = ledger.get(key);
    if (!row || row.status !== "completed") return 0;
    return row.amountMinor;
  }

  // -------------------------------------------------------------- the decision

  /**
   * Why this key cannot be credited under, if it cannot. Two ways:
   *
   * - it belongs to somebody else. Unreachable, but a credit is not the place to
   *   find out that it is;
   * - it is occupied by a row that is not `completed`. Such a row is worth zero
   *   toward the balance *and* holds the unique key, so the shortfall it leaves
   *   can never be written under that key — every run would plan a credit that
   *   `recordWalletTransaction` then no-ops. Reported rather than retried
   *   forever; settling or failing that row is the repair.
   */
  function keyBlocked(key: string, userId: string): string | null {
    const row = ledger.get(key);
    if (!row) return null;
    if (row.userId !== userId) return `${key} already belongs to ${row.userId}`;
    if (row.status !== "completed") {
      return `${key} is held by a ${row.status} row worth nothing — the key is taken and cannot be credited under`;
    }
    return null;
  }

  function decide(pair: Pair): Plan {
    if (!pair.started && !PAY_NON_STARTERS) {
      return { action: "skipped", pair, why: "every result row for this pair is `dns`" };
    }

    if (!pair.registrationId) {
      const key = legacyKey(pair.userId, pair.eventSlug);
      const blocked = keyBlocked(key, pair.userId);
      if (blocked) return { action: "anomaly", pair, why: blocked };
      if (ledger.has(key)) return { action: "settled", pair, heldMinor: worth(key) };
      return { action: "full", pair, key, amountMinor: TARGET_MINOR };
    }

    const base = participationKey(pair.registrationId);
    const top = topupKey(pair.registrationId);
    const baseRow = ledger.get(base);

    for (const key of [base, top]) {
      const blocked = keyBlocked(key, pair.userId);
      if (blocked) return { action: "anomaly", pair, why: blocked };
    }

    const heldMinor = worth(base) + worth(top);

    if (!baseRow) {
      // A top-up without its canonical row is not a state this script can
      // produce, and crediting the full reward on top of it would overpay.
      if (heldMinor > 0) {
        return { action: "anomaly", pair, why: `${top} exists without ${base}` };
      }
      return { action: "full", pair, key: base, amountMinor: TARGET_MINOR };
    }

    const shortfall = TARGET_MINOR - heldMinor;
    if (shortfall <= 0) return { action: "settled", pair, heldMinor };
    return { action: "topup", pair, key: top, amountMinor: shortfall, heldMinor };
  }

  const plans = all.map(decide);

  // ------------------------------------------------------------------ the report

  const sourceCount = (source: Source) => all.filter((pair) => pair.sources.has(source)).length;
  const nonStarters = all.filter((pair) => !pair.started);

  line();
  line("Sources of a participation (union, de-duplicated to distinct (user, event) pairs)");
  line(
    `  event_results rows                  ${resultRows.length}, ` +
      `${resultRows.length - orphans.length - mismatched.length} resolved to an account → ${resultPairs} pairs`,
  );
  line(
    `    by status                         ` +
      [...resultStatusCount.entries()]
        .sort()
        .map(([status, count]) => `${status} ${count}`)
        .join(", "),
  );
  line(
    `  event_registrations checked_in      ${checkedIn.length} → pairs touching: ${sourceCount("checked_in")}`,
  );
  line(
    `  legacy_participations attended      ${legacy.length} → pairs touching: ${sourceCount("legacy")}`,
  );
  line(`  distinct (user, event) pairs        ${all.length}`);
  line(
    `  of which non-starters (dns only)    ${nonStarters.length} ` +
      `— ${acer(nonStarters.length * TARGET_MINOR)} ACER hangs on this decision`,
  );

  const empty = () => ({ full: 0, topup: 0, settled: 0, skipped: 0, anomaly: 0, minor: 0 });
  const byEvent = new Map<string, ReturnType<typeof empty> & { pairs: number }>();
  for (const plan of plans) {
    const slug = plan.pair.eventSlug;
    const row = byEvent.get(slug) ?? { pairs: 0, ...empty() };
    row.pairs += 1;
    row[plan.action satisfies Action] += 1;
    if (plan.action === "full" || plan.action === "topup") row.minor += plan.amountMinor;
    byEvent.set(slug, row);
  }

  line();
  line(`${APPLY ? "Writing" : "Would write"} — per event`);
  line("  event                 pairs   full  topup  settled  skipped  anomaly     ACER");
  const totals = { pairs: 0, ...empty() };
  for (const [slug, row] of [...byEvent.entries()].sort()) {
    line(
      `  ${slug.padEnd(20)} ${String(row.pairs).padStart(5)}  ${String(row.full).padStart(5)}` +
        `  ${String(row.topup).padStart(5)}  ${String(row.settled).padStart(7)}` +
        `  ${String(row.skipped).padStart(7)}  ${String(row.anomaly).padStart(7)}` +
        `  ${acer(row.minor).padStart(7)}`,
    );
    totals.pairs += row.pairs;
    totals.full += row.full;
    totals.topup += row.topup;
    totals.settled += row.settled;
    totals.skipped += row.skipped;
    totals.anomaly += row.anomaly;
    totals.minor += row.minor;
  }
  line(
    `  ${"TOTAL".padEnd(20)} ${String(totals.pairs).padStart(5)}  ${String(totals.full).padStart(5)}` +
      `  ${String(totals.topup).padStart(5)}  ${String(totals.settled).padStart(7)}` +
      `  ${String(totals.skipped).padStart(7)}  ${String(totals.anomaly).padStart(7)}` +
      `  ${acer(totals.minor).padStart(7)}`,
  );

  line();
  line(
    `Grand total: ${acer(totals.minor)} ACER in ${totals.full + totals.topup} ledger row(s) ` +
      `(${totals.full} full credits, ${totals.topup} top-ups; ${totals.settled} already at target)`,
  );
  if (!APPLY) {
    const withNonStarters = totals.minor + nonStarters.length * TARGET_MINOR;
    line(
      `  --skip-non-starters → ${acer(totals.minor)} ACER in ${totals.full + totals.topup} rows` +
        ` · --pay-non-starters → ${acer(withNonStarters)} ACER in ` +
        `${totals.full + totals.topup + nonStarters.length} rows`,
    );
  }

  const anomalies = plans.filter(
    (plan): plan is Extract<Plan, { action: "anomaly" }> => plan.action === "anomaly",
  );
  if (anomalies.length > 0) {
    line();
    line(`Anomalies — skipped, nothing written for these ${anomalies.length} pair(s):`);
    for (const plan of anomalies) {
      line(`  ${plan.pair.eventSlug}  user ${plan.pair.userId}  ${plan.why}`);
    }
  }

  if (mismatched.length > 0) {
    line();
    line(
      `Result rows linked to a registration for another night — skipped (${mismatched.length}):`,
    );
    for (const text of mismatched) line(`  ${text}`);
  }

  // Ledger rows keyed `participation:<uuid>` that no pair above claims. These are
  // credits whose registration has since been deleted: nothing can top them up,
  // because the fact they were keyed on is gone. Printed because the plan
  // expected them to appear in the top-up column and they never will. Skipped
  // under `--only`, where "no pair claims it" just means "another night does".
  const wantedKeys = new Set(wanted);
  const stranded =
    ONLY.size > 0
      ? []
      : (
          await db
            .select({
              key: walletTransactions.idempotencyKey,
              userId: walletTransactions.userId,
              amountMinor: walletTransactions.amountMinor,
              reference: walletTransactions.reference,
            })
            .from(walletTransactions)
            .where(like(walletTransactions.idempotencyKey, "participation:%"))
        ).filter((row) => !wantedKeys.has(row.key as string));
  if (stranded.length > 0) {
    line();
    line(
      `Stranded participation credits (${stranded.length}) — keyed on a registration that no ` +
        `longer exists, so no pair claims them and nothing tops them up:`,
    );
    for (const row of stranded) {
      line(
        `  ${row.key}  user ${row.userId}  ${acer(row.amountMinor)} ACER  ${row.reference ?? "-"}`,
      );
    }
  }

  // The unresolved rows, split by what a human can actually do about them. On a
  // series night an unlinked row means a walk-up or a spelling mismatch and an
  // account probably exists. On `warsaw-2026` the results predate the `users`
  // table entirely — attendance there is carried by `legacy_participations`, so
  // an unlinked row is the normal case for a runner who never made an account.
  const legacySlugs = new Set(legacy.map((row) => row.eventSlug));
  const sortOrphans = (rows: Orphan[]) =>
    [...rows].sort(
      (a, b) =>
        a.eventSlug.localeCompare(b.eventSlug) || a.heatNumber - b.heatNumber || a.bib - b.bib,
    );
  const seriesOrphans = sortOrphans(orphans.filter((row) => !legacySlugs.has(row.eventSlug)));
  const legacyOrphans = sortOrphans(orphans.filter((row) => legacySlugs.has(row.eventSlug)));

  for (const [title, rows] of [
    [
      `Series result rows with no account (${seriesOrphans.length}) — NOT name-matched, NOT paid. ` +
        `A wrong match pays a stranger; a human decides these`,
      seriesOrphans,
    ],
    [
      `Legacy (${[...legacySlugs].join(", ")}) result rows with no account (${legacyOrphans.length}) ` +
        `— expected: those results predate the users table, and attendance there is carried by ` +
        `legacy_participations instead`,
      legacyOrphans,
    ],
  ] as const) {
    if (rows.length === 0) continue;
    line();
    line(`${title}:`);
    line("  event                 heat  bib  status    name");
    for (const row of rows) {
      line(
        `  ${row.eventSlug.padEnd(20)} ${String(row.heatNumber).padStart(4)}` +
          `  ${String(row.bib).padStart(3)}  ${row.status.padEnd(8)}  ${row.name}`,
      );
    }
  }

  if (!APPLY) {
    line();
    line("Dry run — nothing was written. Re-run with --apply and a non-starter decision:");
    line(
      "  ALLOW_FIXTURES=1 npx tsx --env-file=.env.local " +
        "scripts/backfill-participation-rewards.ts --apply --skip-non-starters",
    );
    process.exit(0);
  }

  // ------------------------------------------------------------------- the write

  let written = 0;
  let alreadyRecorded = 0;
  for (const plan of plans) {
    if (plan.action !== "full" && plan.action !== "topup") continue;
    const row = await recordWalletTransaction({
      userId: plan.pair.userId,
      asset: "ACER",
      amountMinor: plan.amountMinor,
      kind: "participation_reward",
      reference: eventReference(plan.pair.eventSlug),
      idempotencyKey: plan.key,
    });
    // `null` is a success: the causing fact was already in the ledger, which is
    // exactly what a second run of this script sees for every row.
    if (row) written += 1;
    else alreadyRecorded += 1;
  }

  line();
  line(
    `Wrote ${written} row(s); ${alreadyRecorded} were already recorded under their key ` +
      `(a no-op, not a failure).`,
  );
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
