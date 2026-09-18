/**
 * DB round-trip for the signup grant (ADR 0013, slice 2 of the paid-entry plan).
 *
 *   ALLOW_FIXTURES=1 npx tsx --env-file=.env.local scripts/verify-signup-grant.ts
 *
 * There is no `--teardown` mode: every id is minted in the run that deletes it,
 * in a `finally`, so a stale mode that guessed at a prefix would be the only way
 * to delete a row this script did not write.
 *
 * Writes to whatever `DATABASE_URL` points at, so it refuses to run without
 * `ALLOW_FIXTURES=1` (`scripts/lib/guard.ts`). There is no branch database.
 *
 * What it proves, against the real data layer rather than a mock:
 *
 *   1. `creditSignupGrant` credits exactly SIGNUP_GRANT_ACER, in one row of kind
 *      `signup_grant`, with no reference and no memo.
 *   2. A second call writes **nothing** and leaves the balance alone — and that
 *      it is the ledger's partial unique index enforcing that and not a guard in
 *      our code, shown by a raw insert on the same key being refused by
 *      Postgres.
 *   3. The **hook fires**: a real `auth.api.signUpEmail` account creation ends up
 *      with the grant row without this script calling the accrual at all.
 *   4. The release condition `SIGNUP_GRANT_ACER >= individual_entry_fee_acer` on
 *      every priced night — a guest who signs up must be able to finish paying
 *      for the race they signed up for.
 *
 * **Mail.** `.env.local` carries a real Resend key and `sendOnSignUp: true` mails
 * the verification link, so step 3 would mail a stranger. The sender module is
 * replaced in `require.cache` *before* the auth module is imported (hence the
 * dynamic `import()` below — a static one is hoisted above every statement and
 * would load the real Resend client first). The stub counts what it intercepts,
 * so "no mail left the building" is asserted rather than assumed, and the
 * fixture address is `@example.invalid`, a domain reserved by RFC 6761 that
 * cannot resolve even if the stub were bypassed.
 *
 * Every fixture id is minted here and teardown deletes exactly those ids.
 */
import { randomUUID } from "node:crypto";

import { eq, gt, inArray, sql } from "drizzle-orm";

import {
  accounts,
  events,
  sessions,
  users,
  verifications,
  walletTransactions,
} from "../src/db/schema";
import { creditSignupGrant } from "../src/features/wallet/accruals";
import { SIGNUP_GRANT_ACER, acerToMinor, minorToAcer } from "../src/features/wallet/config";
import { getAcerBalance } from "../src/features/wallet/data";
import { getDb } from "../src/lib/db";
import { requireFixtureConsent } from "./lib/guard";

requireFixtureConsent("scripts/verify-signup-grant.ts");

const PREFIX = "sgv-";

/** Ids this run created, and the only rows teardown is allowed to touch. */
const created = { userIds: [] as string[], verificationIds: [] as string[] };

let pass = 0;
let fail = 0;

function check(label: string, ok: boolean, detail = "") {
  if (ok) {
    pass += 1;
    console.log(`  ok   ${label}`);
  } else {
    fail += 1;
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function eq_(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  check(label, a === e, `got ${a}, want ${e}`);
}

/* ── the mail stub ──────────────────────────────────────────────────────── */

let mailIntercepted = 0;

/**
 * Put a fake `src/lib/email` in `require.cache` so the real one — which builds a
 * live Resend client from `RESEND_API_KEY` at module scope — never executes.
 * Returns whether the seat was taken before us, which would mean something
 * imported the real module first and the stub is worthless.
 */
function stubMailSender(): boolean {
  const modulePath = require.resolve("../src/lib/email");
  const alreadyLoaded = modulePath in require.cache;

  // A standalone object rather than a method reading `this`: the consumer does
  // `import { getResend }` and calls it detached, so `this` is undefined there.
  const sender = {
    emails: {
      send: async (payload: { to: string; subject: string }) => {
        mailIntercepted += 1;
        console.log(`  [stub] intercepted mail to ${payload.to} — "${payload.subject}"`);
        return { data: { id: "stub" }, error: null };
      },
    },
  };

  const stub = {
    __stub: true,
    FROM_EMAIL: "fixture <no-reply@example.invalid>",
    resend: sender,
    getResend: () => sender,
  };

  require.cache[modulePath] = {
    id: modulePath,
    filename: modulePath,
    path: modulePath,
    loaded: true,
    children: [],
    paths: [],
    exports: stub,
  } as unknown as NodeModule;

  return alreadyLoaded;
}

/* ── fixtures ───────────────────────────────────────────────────────────── */

async function makeUser(suffix: string): Promise<string> {
  const id = `${PREFIX}${suffix}-${randomUUID()}`;
  await getDb()
    .insert(users)
    .values({
      id,
      name: `Signup Grant ${suffix}`,
      email: `${id}@example.invalid`,
      emailVerified: true,
    });
  created.userIds.push(id);
  return id;
}

/** One user's ledger rows, oldest first. */
async function ledger(userId: string) {
  return getDb()
    .select({
      id: walletTransactions.id,
      kind: walletTransactions.kind,
      amountMinor: walletTransactions.amountMinor,
      asset: walletTransactions.asset,
      status: walletTransactions.status,
      reference: walletTransactions.reference,
      memo: walletTransactions.memo,
      createdBy: walletTransactions.createdBy,
      idempotencyKey: walletTransactions.idempotencyKey,
    })
    .from(walletTransactions)
    .where(eq(walletTransactions.userId, userId))
    .orderBy(walletTransactions.createdAt);
}

async function teardown(quiet = false) {
  const db = getDb();

  if (created.verificationIds.length) {
    await db.delete(verifications).where(inArray(verifications.id, created.verificationIds));
  }
  if (created.userIds.length) {
    // Ledger rows first: `created_by` is `set null`, so they would outlive the
    // user and leak into somebody's numbers. `sessions` and `accounts` cascade
    // on the user delete, but they are removed explicitly so the script says
    // out loud what the sign-up created.
    await db.delete(walletTransactions).where(inArray(walletTransactions.userId, created.userIds));
    await db.delete(sessions).where(inArray(sessions.userId, created.userIds));
    await db.delete(accounts).where(inArray(accounts.userId, created.userIds));
    await db.delete(users).where(inArray(users.id, created.userIds));
  }

  if (!quiet) {
    console.log(
      `tore down ${created.userIds.length} fixture users, ` +
        `${created.verificationIds.length} verification rows`,
    );
  }
  created.userIds.length = 0;
  created.verificationIds.length = 0;
}

/* ── the run ────────────────────────────────────────────────────────────── */

const EXPECTED_MINOR = acerToMinor(SIGNUP_GRANT_ACER);

async function run() {
  const db = getDb();
  console.log(
    `\nSIGNUP_GRANT_ACER = ${SIGNUP_GRANT_ACER} → ${EXPECTED_MINOR} minor units per account`,
  );

  /* ── 1. one call, one row ─────────────────────────────────────────── */
  console.log("\n1. a fresh account credited by creditSignupGrant");
  const runner = await makeUser("runner");
  await creditSignupGrant(runner);

  const first = await ledger(runner);
  console.log(
    `   rows=${first.length} balance=${await getAcerBalance(runner)} minor ` +
      `(${minorToAcer(await getAcerBalance(runner))} ACER)`,
  );
  eq_("exactly one ledger row", first.length, 1);
  eq_("of kind signup_grant", first[0]?.kind, "signup_grant");
  eq_("in ACER", first[0]?.asset, "ACER");
  eq_(`worth +${EXPECTED_MINOR} minor units`, first[0]?.amountMinor, EXPECTED_MINOR);
  eq_("counts toward the balance", first[0]?.status, "completed");
  eq_("keyed by the account", first[0]?.idempotencyKey, `signup:${runner}`);
  // No reference: the cause is the account, which is already the row's user_id.
  eq_("carries no reference", first[0]?.reference, null);
  eq_("carries no untranslatable memo", first[0]?.memo, null);
  eq_("is a system row, no admin author", first[0]?.createdBy, null);
  eq_(`balance is exactly ${EXPECTED_MINOR} minor units`, await getAcerBalance(runner), 500);

  /* ── 2. the second call writes nothing ────────────────────────────── */
  console.log("\n2. calling it again writes nothing");
  await creditSignupGrant(runner);
  await creditSignupGrant(runner);
  const second = await ledger(runner);
  console.log(
    `   after 3 calls total: rows=${second.length} balance=${await getAcerBalance(runner)} minor`,
  );
  eq_("still one row", second.length, 1);
  eq_("and it is the same row", second[0]?.id, first[0]?.id);
  eq_("balance unchanged", await getAcerBalance(runner), EXPECTED_MINOR);

  console.log("\n   …and it is the index, not a guard, that says so");
  // `creditSignupGrant` never reads "has this user been granted?" — it hands the
  // key to Postgres. Proof: the same key offered as a plain insert, with no
  // `onConflictDoNothing` to absorb it, must be refused by the database itself.
  let refusal = "";
  try {
    await db.insert(walletTransactions).values({
      userId: runner,
      asset: "ACER",
      amountMinor: EXPECTED_MINOR,
      kind: "signup_grant",
      idempotencyKey: `signup:${runner}`,
    });
  } catch (error) {
    refusal = error instanceof Error ? error.message : String(error);
  }
  console.log(`   postgres said: ${refusal.split("\n")[0] || "(nothing — it accepted it!)"}`);
  check("a raw duplicate of the key is refused by the unique index", refusal.length > 0);
  eq_("and still only one row exists", (await ledger(runner)).length, 1);

  /* ── 3. the hook fires on a real account creation ─────────────────── */
  console.log("\n3. real sign-up through Better Auth credits without being asked");
  const stubWasLate = stubMailSender();
  check("the mail sender was stubbed before anything loaded the real one", !stubWasLate);

  const beforeVerifications = new Set(
    (await db.select({ id: verifications.id }).from(verifications)).map((r) => r.id),
  );

  // Dynamic on purpose — see the header. Importing this is what wires the
  // `user.create.after` hook; nothing below calls `creditSignupGrant`.
  const { auth } = await import("../src/lib/auth/better-auth");

  const email = `verify-signup-${randomUUID()}@example.invalid`;
  const signUp = await auth.api.signUpEmail({
    body: {
      email,
      password: randomUUID(),
      name: "Signup Grant Hook",
      firstName: "Signup",
      lastName: "Hook",
      locale: "en",
    },
  });
  const hookUserId = signUp.user.id;
  created.userIds.push(hookUserId);
  console.log(`   created ${email} → user ${hookUserId}`);

  for (const row of await db.select({ id: verifications.id }).from(verifications)) {
    if (!beforeVerifications.has(row.id)) created.verificationIds.push(row.id);
  }

  // Better Auth sends the verification mail through `runInBackgroundOrAwait`,
  // so give the interception a few ticks before reading the counter rather than
  // racing it into a flaky red.
  for (let i = 0; i < 20 && mailIntercepted === 0; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  const hookRows = await ledger(hookUserId);
  console.log(
    `   rows=${hookRows.length} balance=${await getAcerBalance(hookUserId)} minor; ` +
      `mail intercepted=${mailIntercepted}, sent for real=0`,
  );
  eq_("the sign-up produced exactly one ledger row", hookRows.length, 1);
  eq_("the hook wrote the grant", hookRows[0]?.kind, "signup_grant");
  eq_(`worth +${EXPECTED_MINOR} minor units`, hookRows[0]?.amountMinor, EXPECTED_MINOR);
  eq_("keyed by the new account", hookRows[0]?.idempotencyKey, `signup:${hookUserId}`);
  eq_("balance is the grant and nothing else", await getAcerBalance(hookUserId), EXPECTED_MINOR);
  check("the verification mail was intercepted, not sent", mailIntercepted >= 1);

  const accountRows = await db
    .select({ providerId: accounts.providerId })
    .from(accounts)
    .where(eq(accounts.userId, hookUserId));
  console.log(`   better-auth also wrote ${accountRows.length} account row(s) to clean up`);

  /* ── 4. the release condition ─────────────────────────────────────── */
  console.log("\n4. release condition: SIGNUP_GRANT_ACER >= every night's individual fee");
  const priced = await db
    .select({ slug: events.slug, fee: events.individualEntryFeeAcer })
    .from(events)
    .where(gt(events.individualEntryFeeAcer, 0))
    .orderBy(events.slug);
  const [totals] = await db
    .select({ total: sql<number>`count(*)`.mapWith(Number) })
    .from(events);

  console.log(`   ${totals?.total ?? 0} event rows, ${priced.length} priced for individuals`);
  for (const row of priced) {
    console.log(`     ${row.slug}: ${row.fee} ACER`);
  }
  const tooExpensive = priced.filter((row) => row.fee > SIGNUP_GRANT_ACER);
  check(
    `no priced night costs more than the ${SIGNUP_GRANT_ACER} ACER grant`,
    tooExpensive.length === 0,
    tooExpensive.map((r) => `${r.slug}=${r.fee}`).join(", "),
  );

  console.log(`\n${pass} passed, ${fail} failed`);
}

async function main() {
  try {
    await run();
  } finally {
    // In a `finally` so a blown assertion or a thrown sign-up still takes its
    // rows with it — the database this runs against is the live one.
    console.log("\ncleaning up…");
    await teardown();
  }
  // The pool keeps the event loop alive; say so explicitly rather than hang.
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
