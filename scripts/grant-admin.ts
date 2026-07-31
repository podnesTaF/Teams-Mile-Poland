/**
 * Grant the `admin` role from the command line.
 *
 * This exists to bootstrap the very first admin: the admin panel is the normal
 * way to add admins, but it is itself admin-gated, so somebody has to be made
 * one from outside. After the first, prefer /admin/admins.
 *
 *   npm run admin:grant -- name@email.com            # dry-run, writes nothing
 *   npm run admin:grant -- name@email.com --write
 *
 * With --write: promotes the account if the email is known, otherwise creates
 * one, and sends the set-password link when the account has no password yet.
 * Idempotent — re-running on an existing admin with a password does nothing but
 * report. Runs against whatever DATABASE_URL points at, which is the live
 * database unless you say otherwise, and RESEND_API_KEY in .env.local means a
 * --write run sends real mail.
 */
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

import { eq } from "drizzle-orm";

/**
 * `src/lib/db` builds its connection from `process.env.DATABASE_URL` at module
 * scope, and static imports are hoisted above the `dotenv.config()` call above
 * — importing it at the top yields a permanently null `db` ("DATABASE_URL is
 * not set") even though the env loaded fine. Everything that touches the db or
 * Better Auth therefore has to be imported dynamically, below.
 */
async function main() {
  const args = process.argv.slice(2);
  const write = args.includes("--write");

  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set (expected in .env.local).");
    process.exit(1);
  }

  const { users } = await import("../src/db/schema");
  const { grantAdmin, looksLikeEmail, normalizeEmail } = await import(
    "../src/features/admin/admin-grant"
  );
  const { getDb } = await import("../src/lib/db");

  const email = normalizeEmail(args.find((a) => !a.startsWith("--")));
  if (!email) {
    console.error("Usage: npm run admin:grant -- name@email.com [--write]");
    process.exit(1);
  }
  if (!looksLikeEmail(email)) {
    console.error(`Not a valid email address: ${email}`);
    process.exit(1);
  }

  const [existing] = await getDb()
    .select({ id: users.id, email: users.email, role: users.role })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!write) {
    console.log(`DRY RUN — nothing written. Target: ${email}`);
    if (!existing) {
      console.log("  account does not exist → would be created and sent a set-password email");
    } else if (existing.role === "admin") {
      console.log("  already an admin → would only re-send a set-password email if it has none");
    } else {
      console.log("  account exists → would be promoted to admin");
    }
    console.log("\nRe-run with --write to apply.");
    return;
  }

  const result = await grantAdmin({ email });
  if (!result.ok) {
    console.error(`Failed: ${result.error}`);
    process.exit(1);
  }

  console.log(`${result.email}: ${result.outcome}`);
  if (result.invited) {
    console.log(
      "Set-password email requested. Resend reports failures in the log above, not as an error —" +
        " if nothing arrives, check for a [auth] reset-password line.",
    );
  } else {
    console.log("No email sent — this account already has a password to sign in with.");
  }
  console.log(`\nSign in at /auth/sign-in, then use the "Admin panel" tab.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
