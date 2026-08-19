/**
 * One-time backfill of `users.phone_e164` from the display `users.phone`.
 *
 *   npx tsx --env-file=.env.local scripts/backfill-phone-e164.ts            # dry-run
 *   ALLOW_FIXTURES=1 npx tsx --env-file=.env.local \
 *     scripts/backfill-phone-e164.ts --write
 *
 * Run AFTER migration 0019 has been applied (the column has to exist), and
 * after `scripts/check-email-case-dupes.ts` cleared that migration to run at
 * all. New and updated profiles get the key from the Better Auth database hooks
 * (`derivePhoneE164` in `src/lib/auth/better-auth.ts`); this script is only for
 * the rows that predate the column.
 *
 * Dry-run by default and idempotent: the target value is a pure function of the
 * stored display phone, so a row already holding the right key is skipped, and a
 * second `--write` run reports zero changes. Interrupting it is safe — it
 * resumes wherever it stopped.
 *
 * `requireFixtureConsent` is asked only for `--write`, which is the only mode
 * that touches the table. A dry-run is a grouped read and needs no permission
 * slip; making the safe mode harder to reach than the writing one would just
 * train people to set the env var by reflex.
 *
 * `updated_at` is deliberately left alone: repairing a derived column is not a
 * profile edit, and bumping it would misdate every account in the admin list.
 */
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { users } from "../src/db/schema";
import { toE164 } from "../src/lib/phone";
import { requireFixtureConsent } from "./lib/guard";

const WRITE = process.argv.includes("--write");

if (WRITE) requireFixtureConsent("scripts/backfill-phone-e164.ts");

/** How many sample rows to print per category before summarising. */
const SAMPLE = 15;

function line(text = ""): void {
  console.log(text);
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set (expected in .env.local)");
    process.exit(1);
  }

  const client = postgres(url, { prepare: false, max: 1 });
  const db = drizzle(client);

  try {
    // Every row, not just the ones with a phone: a row holding a stale key for a
    // phone that has since been cleared needs the key cleared too, and that is
    // exactly the case a `where phone is not null` filter would hide.
    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        phone: users.phone,
        phoneE164: users.phoneE164,
      })
      .from(users);

    const toSet: { id: string; email: string; phone: string; next: string }[] = [];
    const toClear: { id: string; email: string; phone: string | null }[] = [];
    const unparseable: { id: string; email: string; phone: string }[] = [];
    let alreadyCorrect = 0;
    let noPhone = 0;

    for (const row of rows) {
      const next = toE164(row.phone);
      const hasPhone = Boolean(row.phone?.trim());

      if (!hasPhone) noPhone += 1;
      else if (next === null) unparseable.push({ id: row.id, email: row.email, phone: row.phone! });

      if (next === row.phoneE164) {
        if (next !== null) alreadyCorrect += 1;
        continue;
      }
      if (next === null) toClear.push({ id: row.id, email: row.email, phone: row.phone });
      else toSet.push({ id: row.id, email: row.email, phone: row.phone!, next });
    }

    line(`${WRITE ? "WRITE" : "DRY-RUN"} — ${rows.length} user rows scanned`);
    line();
    // First three are the disjoint outcomes and add up to the row count with
    // the untouched-null rows; the last two are diagnostics that cut across
    // them (a row can be both "no phone stored" and "stale key to clear").
    line(`  keys to write:        ${toSet.length}`);
    line(`  stale keys to clear:  ${toClear.length}`);
    line(`  already correct:      ${alreadyCorrect}`);
    line(`  -- diagnostics (overlap the above) --`);
    line(`  no phone stored:      ${noPhone}`);
    line(`  phone won't reduce:   ${unparseable.length}  (stays null — see below)`);
    line();

    if (toSet.length) {
      line(`Keys to write (${Math.min(SAMPLE, toSet.length)} of ${toSet.length} shown):`);
      for (const row of toSet.slice(0, SAMPLE)) {
        line(`  ${row.email.padEnd(36)} ${row.phone.padEnd(20)} -> ${row.next}`);
      }
      line();
    }

    if (toClear.length) {
      line(`Stale keys to clear (${Math.min(SAMPLE, toClear.length)} of ${toClear.length} shown):`);
      for (const row of toClear.slice(0, SAMPLE)) {
        line(`  ${row.email.padEnd(36)} phone=${JSON.stringify(row.phone)} -> null`);
      }
      line();
    }

    if (unparseable.length) {
      // Not a failure: `toE164` holds a deliberately strict bar, and legacy
      // `runners.phone` was never validated. These rows simply cannot take part
      // in phone-based duplicate detection, and this list is the record of that.
      line(
        `Phones libphonenumber will not confirm (${Math.min(SAMPLE, unparseable.length)} of ${unparseable.length} shown):`,
      );
      for (const row of unparseable.slice(0, SAMPLE)) {
        line(`  ${row.email.padEnd(36)} ${JSON.stringify(row.phone)}`);
      }
      line();
    }

    // What the column is for — worth seeing before and after the write, since a
    // backfill that produced no duplicate groups at all would be a hint that
    // `toE164` is rejecting more than it should.
    const projected = new Map<string, number>();
    for (const row of rows) {
      const key = toE164(row.phone);
      if (key) projected.set(key, (projected.get(key) ?? 0) + 1);
    }
    const shared = [...projected.entries()].filter(([, n]) => n > 1);
    line(
      `Projected duplicate phone keys: ${shared.length} number${shared.length === 1 ? "" : "s"} shared by ${shared.reduce((sum, [, n]) => sum + n, 0)} accounts`,
    );
    line("  (reporting them is task 09's job — this is only a sanity signal)");
    line();

    if (!WRITE) {
      line("Nothing written. Re-run with --write (and ALLOW_FIXTURES=1) to apply.");
      return;
    }

    if (!toSet.length && !toClear.length) {
      line("Nothing to do — every row already holds the right key.");
      return;
    }

    // One transaction: the column is derived, so a half-applied backfill is a
    // table where some rows answer duplicate queries and some do not.
    await db.transaction(async (tx) => {
      for (const row of toSet) {
        await tx.update(users).set({ phoneE164: row.next }).where(eq(users.id, row.id));
      }
      for (const row of toClear) {
        await tx.update(users).set({ phoneE164: null }).where(eq(users.id, row.id));
      }
    });

    line(`Wrote ${toSet.length} key${toSet.length === 1 ? "" : "s"}, cleared ${toClear.length}.`);
    line("Backfill complete.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
