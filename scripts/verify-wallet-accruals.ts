/**
 * Throwaway DB round-trip for the ACER accrual slice (#48).
 *
 *   ALLOW_FIXTURES=1 npx tsx --env-file=.env.local scripts/verify-wallet-accruals.ts
 *   ALLOW_FIXTURES=1 npx tsx --env-file=.env.local scripts/verify-wallet-accruals.ts --teardown
 *
 * Both modes write to whatever `DATABASE_URL` points at, so both refuse to run
 * without `ALLOW_FIXTURES=1` (`scripts/lib/guard.ts`). There is no Neon branch
 * in this session; it was driven against a throwaway Postgres 16 with the
 * migrations applied.
 *
 * What it proves, against the real data layer rather than a mock: every path
 * that marks a runner present credits the participation reward exactly once, a
 * referrer is paid once per referred person and never again, an unreferred
 * runner produces one row and no error, and a wallet failure cannot fail a
 * check-in.
 *
 * Every fixture is prefixed `wav-` and every delete is scoped to ids this
 * script created.
 */
import { eq, inArray, like, or, sql } from "drizzle-orm";

import { eventRegistrations, users, walletTransactions } from "../src/db/schema";
import {
  checkInWithBib,
  checkInWithoutBib,
  leaseBibForCheckedIn,
  setRegistrationStatus,
} from "../src/features/admin/events-data";
import { getWalletBalances } from "../src/features/wallet/data";
import { getDb } from "../src/lib/db";
import { requireFixtureConsent } from "./lib/guard";

requireFixtureConsent("scripts/verify-wallet-accruals.ts");

const SLUG = "mile-2026-08-22";
const OTHER = "mile-2026-08-29";
const PREFIX = "wav-";

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

async function makeUser(suffix: string, referredBy: string | null = null): Promise<string> {
  const id = `${PREFIX}${suffix}`;
  await getDb()
    .insert(users)
    .values({
      id,
      name: `Accrual ${suffix}`,
      email: `${id}@example.test`,
      emailVerified: true,
      referredBy,
    });
  return id;
}

async function register(userId: string, eventSlug: string): Promise<string> {
  const [row] = await getDb()
    .insert(eventRegistrations)
    .values({ eventSlug, userId, terms: true })
    .returning({ id: eventRegistrations.id });
  return row.id;
}

/** The user's ledger rows, oldest first — kind, signed minor units, reference, memo. */
async function ledger(userId: string) {
  const rows = await getDb()
    .select({
      kind: walletTransactions.kind,
      amountMinor: walletTransactions.amountMinor,
      reference: walletTransactions.reference,
      memo: walletTransactions.memo,
      status: walletTransactions.status,
      idempotencyKey: walletTransactions.idempotencyKey,
      createdBy: walletTransactions.createdBy,
    })
    .from(walletTransactions)
    .where(eq(walletTransactions.userId, userId))
    .orderBy(walletTransactions.createdAt);
  return rows;
}

async function teardown(quiet = false) {
  const db = getDb();
  const ids = (
    await db.select({ id: users.id }).from(users).where(like(users.id, `${PREFIX}%`))
  ).map((r) => r.id);
  if (ids.length === 0) {
    if (!quiet) console.log("nothing to tear down");
    return;
  }
  // Ledger rows first: `created_by` is `set null`, so they would survive the
  // user delete and leak into a later run's counts.
  await db
    .delete(walletTransactions)
    .where(or(inArray(walletTransactions.userId, ids), inArray(walletTransactions.createdBy, ids)));
  await db.delete(eventRegistrations).where(inArray(eventRegistrations.userId, ids));
  await db.delete(users).where(inArray(users.id, ids));
  console.log(`tore down ${ids.length} fixture users and their rows`);
}

async function run() {
  await teardown(true);

  /* ── 1. participation reward, explicit bib ───────────────────────── */
  console.log("\n1. explicit bib → one participation reward");
  const referrer = await makeUser("referrer");
  const runner = await makeUser("runner", referrer);
  const reg = await register(runner, SLUG);

  await checkInWithBib(reg, 11);
  const afterFirst = await ledger(runner);
  eq_("runner has exactly one row", afterFirst.length, 1);
  eq_("it is the participation reward", afterFirst[0]?.kind, "participation_reward");
  eq_("worth +1 ACER in minor units", afterFirst[0]?.amountMinor, 100);
  eq_("references the event by slug", afterFirst[0]?.reference, `event:${SLUG}`);
  eq_("keyed by the registration", afterFirst[0]?.idempotencyKey, `participation:${reg}`);
  eq_("is a system row, no admin author", afterFirst[0]?.createdBy, null);
  eq_("counts toward the balance", afterFirst[0]?.status, "completed");
  // No memo on purpose: a stored sentence cannot be translated, and the row's
  // timestamp already is the race night. See `accruals.ts`.
  eq_("carries no untranslatable memo", afterFirst[0]?.memo, null);
  eq_("ACER balance is 1.00", (await getWalletBalances(runner)).ACER, 100);

  /* ── 2. referral reward to the referrer ──────────────────────────── */
  console.log("\n2. referred runner's first check-in pays the referrer");
  const referrerRows = await ledger(referrer);
  eq_("referrer has exactly one row", referrerRows.length, 1);
  eq_("it is the invitation reward", referrerRows[0]?.kind, "referral_signup");
  eq_("worth +1 ACER", referrerRows[0]?.amountMinor, 100);
  eq_("keyed by the referred person", referrerRows[0]?.idempotencyKey, `referral_checkin:${runner}`);
  eq_("references the event the referred person raced", referrerRows[0]?.reference, `event:${SLUG}`);
  eq_("carries no untranslatable memo", referrerRows[0]?.memo, null);

  console.log("\n   a self-referral pays once, not twice");
  const selfRef = await makeUser("selfref");
  await getDb().update(users).set({ referredBy: selfRef }).where(eq(users.id, selfRef));
  const selfRefReg = await register(selfRef, SLUG);
  await checkInWithBib(selfRefReg, 51);
  const selfRefRows = await ledger(selfRef);
  eq_("one row only", selfRefRows.length, 1);
  eq_("and it is the participation reward", selfRefRows[0]?.kind, "participation_reward");

  /* ── 3. repeats are no-ops ───────────────────────────────────────── */
  console.log("\n3. re-scans and desk retries change nothing");
  await checkInWithBib(reg, 11);
  await checkInWithBib(reg, 12);
  eq_("runner still has one row", (await ledger(runner)).length, 1);
  eq_("referrer still has one row", (await ledger(referrer)).length, 1);

  console.log("\n   undo → check in again is still one reward");
  await setRegistrationStatus(reg, "registered");
  await checkInWithBib(reg, 13);
  eq_("runner still has one row", (await ledger(runner)).length, 1);

  /* ── 4. bib-pending is a full check-in and earns ─────────────────── */
  console.log("\n4. exhausted pool (bib-pending) earns the same");
  const regOther = await register(runner, OTHER);
  await checkInWithoutBib(regOther);
  const twoEvents = await ledger(runner);
  eq_("runner now has two rows", twoEvents.length, 2);
  eq_("the second is a participation reward", twoEvents[1]?.kind, "participation_reward");
  eq_("for the other event", twoEvents[1]?.reference, `event:${OTHER}`);
  eq_("ACER balance is 2.00", (await getWalletBalances(runner)).ACER, 200);

  console.log("\n   the referrer is NOT paid twice for the same person");
  eq_("referrer still has one row", (await ledger(referrer)).length, 1);
  eq_("referrer balance is 1.00", (await getWalletBalances(referrer)).ACER, 100);

  /* ── 5. a later bib lease is not a new check-in ──────────────────── */
  console.log("\n5. handing a waiting runner a freed bib credits nothing new");
  eq_("lease succeeds", await leaseBibForCheckedIn(OTHER, regOther, 21), true);
  eq_("runner still has two rows", (await ledger(runner)).length, 2);

  /* ── 6. no referrer → no referral row, no error ──────────────────── */
  console.log("\n6. an unreferred runner earns alone");
  const solo = await makeUser("solo");
  const soloReg = await register(solo, SLUG);
  await checkInWithBib(soloReg, 31);
  const soloRows = await ledger(solo);
  eq_("one row only", soloRows.length, 1);
  eq_("and it is the participation reward", soloRows[0]?.kind, "participation_reward");
  eq_(
    "no referral row exists for anyone keyed on them",
    (
      await getDb()
        .select({ id: walletTransactions.id })
        .from(walletTransactions)
        .where(eq(walletTransactions.idempotencyKey, `referral_checkin:${solo}`))
    ).length,
    0,
  );

  /* ── 7. a self-referring chain pays the chain, not the runner ────── */
  console.log("\n7. the referrer's own check-in pays their own referrer");
  const topReg = await register(referrer, SLUG);
  await checkInWithBib(topReg, 41);
  const referrerAfter = await ledger(referrer);
  eq_("referrer now has two rows (invite + own participation)", referrerAfter.length, 2);
  eq_("the new one is their own participation", referrerAfter[1]?.kind, "participation_reward");
  eq_("nobody referred them, so no third row", referrerAfter.length, 2);

  /* ── 8. a wallet failure cannot fail the check-in ────────────────── */
  console.log("\n8. a broken accrual leaves the check-in standing");
  const brittle = await makeUser("brittle");
  const brittleReg = await register(brittle, SLUG);
  // Poison the natural key: the participation row for this registration is
  // already taken by a *different* user, so the real insert hits the unique
  // index as a genuine conflict on somebody else's fact.
  await getDb().insert(walletTransactions).values({
    userId: solo,
    asset: "ACER",
    amountMinor: 100,
    kind: "participation_reward",
    idempotencyKey: `participation:${brittleReg}`,
  });
  await checkInWithBib(brittleReg, 42);
  const [brittleRow] = await getDb()
    .select({ status: eventRegistrations.status })
    .from(eventRegistrations)
    .where(eq(eventRegistrations.id, brittleReg));
  eq_("the runner is checked in regardless", brittleRow?.status, "checked_in");
  eq_("and earned nothing", (await ledger(brittle)).length, 0);

  console.log("\n   …and so does an outright rejected ledger write");
  // The conflict above is absorbed by the idempotency index rather than thrown,
  // so it does not exercise the catch. This does: a trigger that refuses every
  // insert stands in for the ledger being unavailable mid-race-morning. Expect
  // two `[wallet] … failed` lines on stderr below — that is the criterion.
  const db = getDb();
  await db.execute(sql`
    create or replace function wav_reject() returns trigger language plpgsql as $$
    begin raise exception 'ledger unavailable (fixture)'; end $$`);
  await db.execute(sql`
    create trigger wav_reject_ins before insert on wallet_transactions
    for each row execute function wav_reject()`);
  const outage = await register(runner, "mile-2026-08-01");
  try {
    await checkInWithBib(outage, 43);
  } finally {
    await db.execute(sql`drop trigger wav_reject_ins on wallet_transactions`);
    await db.execute(sql`drop function wav_reject()`);
  }
  const [outageRow] = await db
    .select({ status: eventRegistrations.status })
    .from(eventRegistrations)
    .where(eq(eventRegistrations.id, outage));
  eq_("the check-in still committed", outageRow?.status, "checked_in");
  eq_("and no phantom rows landed", (await ledger(runner)).length, 2);

  /* ── 9. isolation ───────────────────────────────────────────────── */
  console.log("\n9. no rows outside the fixture");
  const strays = await getDb()
    .select({ userId: walletTransactions.userId })
    .from(walletTransactions);
  eq_(
    "every ledger row belongs to a fixture user",
    strays.filter((r) => !r.userId.startsWith(PREFIX)).length,
    0,
  );

  console.log(`\n${pass} passed, ${fail} failed`);
}

async function main() {
  if (process.argv.includes("--teardown")) {
    await teardown();
    process.exit(0);
  }
  try {
    await run();
  } finally {
    console.log("\ncleaning up…");
    await teardown(true);
  }
  process.exit(fail === 0 ? 0 : 1);
}

void main();
