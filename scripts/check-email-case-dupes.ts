/**
 * Precheck for migration 0019: can `users` take a UNIQUE index on lower(email)?
 *
 *   npx tsx --env-file=.env.local scripts/check-email-case-dupes.ts
 *
 * MUST BE RUN BEFORE `npm run db:migrate` picks up 0019. That migration creates
 * `users_email_lower_uq`, and Postgres refuses to build a unique index over data
 * that already violates it — two rows whose emails differ only by casing take
 * the whole migration down with them (the phone_e164 column included). The
 * failure is clean, not corrupting, but the fix is manual: decide which account
 * survives, move whatever hangs off the loser, delete it. This script is what
 * tells you whether there is anything to decide.
 *
 * Read-only — a single grouped SELECT, no writes, no `ALLOW_FIXTURES` gate.
 * Exits 0 when the table is clean, 1 when it is not, so it can front the
 * migration in a shell chain.
 */
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set (expected in .env.local)");
    process.exit(1);
  }

  const { hostname, pathname } = new URL(url);
  console.log(`Checking ${hostname}${pathname} for case-variant duplicate emails.`);

  const client = postgres(url, { prepare: false, max: 1 });
  const db = drizzle(client);

  try {
    // Grouped on lower(email) rather than joined to itself: the answer needed is
    // "which mailboxes are stored more than once", and the ids/emails per group
    // are what a manual merge starts from.
    const rows = await db.execute<{
      lower_email: string;
      variants: number;
      ids: string[];
      emails: string[];
    }>(sql`
      select
        lower(email)                as lower_email,
        count(*)::int               as variants,
        array_agg(id order by created_at) as ids,
        array_agg(email order by created_at) as emails
      from users
      group by lower(email)
      having count(*) > 1
      order by count(*) desc, lower(email)
    `);

    const groups = Array.from(rows);
    if (groups.length === 0) {
      console.log("OK — no case-variant duplicates. Migration 0019 can be applied.");
      return;
    }

    console.error(
      `BLOCKED — ${groups.length} mailbox${groups.length === 1 ? "" : "es"} stored under more than one casing.`,
    );
    console.error("Migration 0019 WILL FAIL until each group is reduced to one row:\n");
    for (const group of groups) {
      console.error(`  ${group.lower_email}  (${group.variants} rows)`);
      group.emails.forEach((email, i) => {
        console.error(`    - ${group.ids[i]}  ${email}`);
      });
    }
    console.error(
      "\nResolution is manual and deliberately not automated here: an account may" +
        "\ncarry registrations, results and referrals. Merge or delete, re-run this," +
        "\nthen migrate.",
    );
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
