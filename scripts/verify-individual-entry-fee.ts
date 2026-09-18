/**
 * DB round-trip for the individual entry fee (ADR 0013, plan slice 3).
 *
 *   ALLOW_FIXTURES=1 npx tsx --env-file=.env.local scripts/verify-individual-entry-fee.ts
 *   ALLOW_FIXTURES=1 npx tsx --env-file=.env.local scripts/verify-individual-entry-fee.ts --teardown
 *
 * Writes to whatever `DATABASE_URL` points at, so it refuses to run without
 * `ALLOW_FIXTURES=1` (`scripts/lib/guard.ts`). There is no branch DB.
 *
 * What it proves, against the real data layer rather than by reading the code:
 * a priced night debits exactly its price in the same transaction as the
 * registration and its consent evidence; a short wallet is refused and **writes
 * nothing at all** — no registration, no submission, no consent row, no ledger
 * row; a night priced `0` writes no ledger row rather than a zero-amount one; a
 * replayed registration hits the unique `(event_slug, user_id)` index and never
 * charges twice; and two concurrent registrations on a balance that covers one
 * are serialised by the per-user lock so exactly one is paid for. It also checks
 * the release condition the plan names — no live night may cost a first-timer
 * more than the signup grant they are given.
 *
 * It drives `createRegistrationWithConsent` directly, not `registerForEvent`:
 * the action needs a session, and forging one would verify a login, not the
 * ledger arithmetic. The action's own pre-check is a courtesy in front of this
 * transaction and refuses with the same numbers.
 *
 * The fixture events are created `draft` on purpose: draft is the one status
 * that is invisible on every public surface, so a script run mid-afternoon
 * cannot advertise a night that does not exist. The data layer does not read
 * status — the action does — so the transaction under test is unaffected.
 *
 * Every fixture id is prefixed `ief-` and every delete is scoped to ids this
 * script created, in a `finally`. Nothing here imports anything that sends mail.
 */
import { and, eq, inArray } from "drizzle-orm";

import {
  consentSubmissions,
  eventRegistrations,
  events,
  registrationConsents,
  users,
  walletTransactions,
} from "../src/db/schema";
import {
  createRegistrationWithConsent,
  isInsufficientAcer,
} from "../src/features/event-registration/data";
import { SIGNUP_GRANT_ACER, acerToMinor, minorToAcer } from "../src/features/wallet/config";
import { individualEntryFeeMinor } from "../src/features/wallet/entry-fees";
import { getAcerBalance, recordWalletTransaction } from "../src/features/wallet/data";
import { buildConsentRows, termsAcceptedFrom } from "../src/lib/legal/consent";
import type { ConsentItemsInput } from "../src/lib/legal/consent";
import { getDb } from "../src/lib/db";
import { requireFixtureConsent } from "./lib/guard";

requireFixtureConsent("scripts/verify-individual-entry-fee.ts");

const PREFIX = "ief-";

/** Every event slug this script may create — and the only ones it may delete. */
const EVENT_SLUGS = [`${PREFIX}priced`, `${PREFIX}free`, `${PREFIX}race-a`, `${PREFIX}race-b`];
/** Every user id this script may create. */
const USER_IDS = [
  `${PREFIX}funded`,
  `${PREFIX}broke`,
  `${PREFIX}freerunner`,
  `${PREFIX}racer`,
];

const FEE_ACER = 5;

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

/** The six individual consents, all answered — what a valid submission carries. */
const ITEMS: ConsentItemsInput = {
  rulesAndRegulations: true,
  ageHealthRisks: true,
  dataTruthfulAndRodo: true,
  publicResultsAwareness: true,
  prizeDataUnderstanding: true,
  imageUse: "agree",
};

function registrationInput(eventSlug: string, userId: string, feeMinor: number) {
  return {
    registration: {
      eventSlug,
      userId,
      locale: "en",
      terms: termsAcceptedFrom("individual" as const, ITEMS),
    },
    submission: {
      docSet: "individual" as const,
      locale: "en",
      snapshot: {
        fullName: `Fixture ${userId}`,
        birthDate: "1990-01-01",
        phoneEmail: `${userId}@example.test`,
        address: "Fixture 1, Warsaw",
        emergencyContact: "Fixture Contact +48 000 000 000",
      },
      ip: null,
      userAgent: "verify-individual-entry-fee",
    },
    consents: buildConsentRows("individual", ITEMS),
    feeMinor,
  };
}

async function makeUser(suffix: string): Promise<string> {
  const id = `${PREFIX}${suffix}`;
  await getDb()
    .insert(users)
    .values({
      id,
      name: `Entry fee ${suffix}`,
      firstName: "Entry",
      lastName: suffix,
      email: `${id}@example.test`,
      emailVerified: true,
    });
  return id;
}

async function makeEvent(slug: string, feeAcer: number) {
  const [row] = await getDb()
    .insert(events)
    .values({
      slug,
      // Invisible on every public surface; the data layer never reads status.
      status: "draft",
      eventType: "individual",
      name: `Entry fee fixture ${slug}`,
      date: "2030-01-01",
      startTime: "18:00",
      endTime: "21:00",
      venue: "Fixture Track",
      city: "Warsaw",
      individualEntryFeeAcer: feeAcer,
    })
    .returning();
  return row;
}

async function grant(userId: string, acer: number) {
  await recordWalletTransaction({
    userId,
    asset: "ACER",
    amountMinor: acerToMinor(acer),
    kind: "admin_credit",
    memo: "fixture",
  });
}

async function ledgerRows(userId: string) {
  return getDb()
    .select()
    .from(walletTransactions)
    .where(eq(walletTransactions.userId, userId))
    .orderBy(walletTransactions.createdAt, walletTransactions.id);
}

/** Registration, submission and consent-row counts for one (event, user) pair. */
async function written(eventSlug: string, userId: string) {
  const db = getDb();
  const regs = await db
    .select({ id: eventRegistrations.id })
    .from(eventRegistrations)
    .where(
      and(eq(eventRegistrations.eventSlug, eventSlug), eq(eventRegistrations.userId, userId)),
    );
  if (regs.length === 0) return { registrations: 0, submissions: 0, consents: 0 };
  const subs = await db
    .select({ id: consentSubmissions.id })
    .from(consentSubmissions)
    .where(
      inArray(
        consentSubmissions.registrationId,
        regs.map((r) => r.id),
      ),
    );
  const rows = subs.length
    ? await db
        .select({ id: registrationConsents.id })
        .from(registrationConsents)
        .where(
          inArray(
            registrationConsents.submissionId,
            subs.map((s) => s.id),
          ),
        )
    : [];
  return { registrations: regs.length, submissions: subs.length, consents: rows.length };
}

async function teardown(quiet = false) {
  const db = getDb();
  // Order matters only for the ledger: consent rows cascade from the
  // registration, submissions cascade from it too, and nothing cascades into
  // `wallet_transactions` (append-only, no FK to a registration).
  await db.delete(walletTransactions).where(inArray(walletTransactions.userId, USER_IDS));
  await db.delete(eventRegistrations).where(inArray(eventRegistrations.eventSlug, EVENT_SLUGS));
  await db.delete(events).where(inArray(events.slug, EVENT_SLUGS));
  await db.delete(users).where(inArray(users.id, USER_IDS));
  if (!quiet) console.log("\nteardown: fixture events, registrations, ledger rows and users gone");
}

async function run() {
  const db = getDb();

  /* ── 0. release condition, over the live rows, before any fixture ── */
  console.log("\n0. release condition: no live night costs more than the signup grant");
  const live = await db
    .select({ slug: events.slug, fee: events.individualEntryFeeAcer })
    .from(events);
  const overpriced = live.filter((e) => e.fee > SIGNUP_GRANT_ACER);
  console.log(
    `   signup grant ${SIGNUP_GRANT_ACER} ACER · ${live.length} event rows · priced: ` +
      `${JSON.stringify(live.filter((e) => e.fee > 0))}`,
  );
  eq_("no night a first-timer's grant cannot pay for", overpriced, []);

  /* ── fixtures ─────────────────────────────────────────────────── */
  const funded = await makeUser("funded");
  const broke = await makeUser("broke");
  const freeRunner = await makeUser("freerunner");
  const racer = await makeUser("racer");
  const priced = await makeEvent(`${PREFIX}priced`, FEE_ACER);
  const free = await makeEvent(`${PREFIX}free`, 0);
  const raceA = await makeEvent(`${PREFIX}race-a`, FEE_ACER);
  const raceB = await makeEvent(`${PREFIX}race-b`, FEE_ACER);

  await grant(funded, 12);
  await grant(broke, 2);
  await grant(freeRunner, 3);
  await grant(racer, FEE_ACER);

  // The price the transaction is given comes from the helper reading the row —
  // never a literal, and never the column by hand (ADR 0013).
  const feeMinor = individualEntryFeeMinor(priced);
  const freeMinor = individualEntryFeeMinor(free);
  console.log(
    `\n   priced night reads ${feeMinor} minor (${minorToAcer(feeMinor)} ACER); ` +
      `free night reads ${freeMinor}`,
  );
  eq_("the helper turns 5 whole ACER into minor units", feeMinor, acerToMinor(FEE_ACER));
  eq_("an unpriced night reads 0", freeMinor, 0);

  /* ── 1. a funded runner pays exactly the fee ───────────────────── */
  console.log("\n1. funded runner registers for a priced night");
  const before1 = await getAcerBalance(funded);
  const reg1 = await createRegistrationWithConsent(
    registrationInput(priced.slug, funded, feeMinor),
  );
  const after1 = await getAcerBalance(funded);
  console.log(`   balance ${before1} → ${after1} minor (fee ${feeMinor})`);
  eq_("balance fell by exactly the fee", before1 - after1, feeMinor);
  eq_("balance is 7 ACER", after1, acerToMinor(7));
  eq_("registration + submission + 6 consent rows", await written(priced.slug, funded), {
    registrations: 1,
    submissions: 1,
    consents: 6,
  });
  const fee1 = (await ledgerRows(funded)).filter((r) => r.kind === "individual_entry_fee");
  eq_("exactly one fee row", fee1.length, 1);
  eq_("it is a debit of the fee", fee1[0]?.amountMinor, -feeMinor);
  eq_("keyed by the registration", fee1[0]?.idempotencyKey, `entry_fee:${reg1.id}`);
  eq_("stamped with the night", fee1[0]?.reference, `event:${priced.slug}`);
  eq_("completed, so it counts toward the balance", fee1[0]?.status, "completed");

  /* ── 2. a short wallet is refused and writes nothing ───────────── */
  console.log("\n2. a runner with 2 ACER is refused — and nothing is written");
  const ledgerBefore2 = (await ledgerRows(broke)).length;
  let refused: unknown = null;
  try {
    await createRegistrationWithConsent(registrationInput(priced.slug, broke, feeMinor));
    check("registration above balance is refused", false, "did not throw");
  } catch (error) {
    refused = error;
    check("registration above balance is refused", isInsufficientAcer(error), String(error));
  }
  console.log(`   threw: ${refused instanceof Error ? refused.message : refused}`);
  eq_("no registration, no submission, no consent row", await written(priced.slug, broke), {
    registrations: 0,
    submissions: 0,
    consents: 0,
  });
  eq_("no new ledger row", (await ledgerRows(broke)).length, ledgerBefore2);
  eq_("balance untouched at 2 ACER", await getAcerBalance(broke), acerToMinor(2));

  /* ── 3. a free night writes no ledger row at all ───────────────── */
  console.log("\n3. a night priced 0 writes no ledger row");
  const ledgerBefore3 = (await ledgerRows(freeRunner)).length;
  await createRegistrationWithConsent(registrationInput(free.slug, freeRunner, freeMinor));
  eq_("registration written", (await written(free.slug, freeRunner)).registrations, 1);
  eq_("ledger unchanged — not even a zero row", (await ledgerRows(freeRunner)).length, ledgerBefore3);
  eq_("balance untouched at 3 ACER", await getAcerBalance(freeRunner), acerToMinor(3));

  /* ── 4. replay: the unique index blocks it, nothing double-charges ─ */
  console.log("\n4. the same runner registers again for the same night");
  let replay: unknown = null;
  try {
    await createRegistrationWithConsent(registrationInput(priced.slug, funded, feeMinor));
    check("a second registration is refused", false, "did not throw");
  } catch (error) {
    replay = error;
    check("a second registration is refused", true);
  }
  console.log(`   threw: ${replay instanceof Error ? replay.message : replay}`);
  eq_(
    "still exactly one fee row",
    (await ledgerRows(funded)).filter((r) => r.kind === "individual_entry_fee").length,
    1,
  );
  eq_("still one registration", (await written(priced.slug, funded)).registrations, 1);
  eq_("balance still 7 ACER", await getAcerBalance(funded), acerToMinor(7));

  /* ── 5. the balance race ───────────────────────────────────────── */
  console.log("\n5. two concurrent registrations on a balance that covers one");
  const settled = await Promise.allSettled([
    createRegistrationWithConsent(registrationInput(raceA.slug, racer, feeMinor)),
    createRegistrationWithConsent(registrationInput(raceB.slug, racer, feeMinor)),
  ]);
  console.log(`   outcomes: ${settled.map((s) => s.status).join(", ")}`);
  eq_("exactly one succeeded", settled.filter((s) => s.status === "fulfilled").length, 1);
  check(
    "the other was a shortfall, not a crash",
    settled.some((s) => s.status === "rejected" && isInsufficientAcer(s.reason)),
    settled
      .filter((s) => s.status === "rejected")
      .map((s) => String((s as PromiseRejectedResult).reason))
      .join(" | "),
  );
  eq_("balance is exactly 0", await getAcerBalance(racer), 0);
  eq_(
    "exactly one fee row for the racer",
    (await ledgerRows(racer)).filter((r) => r.kind === "individual_entry_fee").length,
    1,
  );
  const raceWritten =
    (await written(raceA.slug, racer)).registrations + (await written(raceB.slug, racer)).registrations;
  eq_("and exactly one registration", raceWritten, 1);

  console.log(`\n${pass} passed, ${fail} failed`);
}

if (process.argv.includes("--teardown")) {
  teardown()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .then(() => process.exit(process.exitCode ?? 0));
} else {
  run()
    .catch((error) => {
      console.error(error);
      fail += 1;
    })
    .finally(async () => {
      await teardown().catch((error) => console.error("teardown failed:", error));
      // The pool keeps the event loop alive; say so explicitly rather than hang.
      process.exit(fail > 0 ? 1 : 0);
    });
}
