/**
 * Throwaway DB round-trip for the ACER purchase slice (#49).
 *
 *   ALLOW_FIXTURES=1 npx tsx --env-file=.env.local scripts/verify-acer-purchase.ts
 *   ALLOW_FIXTURES=1 npx tsx --env-file=.env.local scripts/verify-acer-purchase.ts --teardown
 *
 * Both modes write to whatever `DATABASE_URL` points at, so both refuse to run
 * without `ALLOW_FIXTURES=1` (`scripts/lib/guard.ts`). Driven against a
 * throwaway Postgres 16 with the migrations applied — this slice adds none.
 *
 * What it proves, against the real data layer rather than a mock: the amount
 * bounds are the server's rule and not the form's, a settled Checkout Session
 * credits exactly one `purchase` row carrying the fiat amount and currency, the
 * **same event delivered twice credits once**, a session that did not settle
 * (or settled in the wrong currency, or carries no buyer) credits nothing, and
 * `hasWalletTransaction` — which drives the page's "may take a moment" note —
 * cannot see another user's session.
 *
 * Every fixture is prefixed `vap-` and every delete is scoped to ids this
 * script created.
 */
import type Stripe from "stripe";
import { inArray, like } from "drizzle-orm";

import { users, walletTransactions } from "../src/db/schema";
import {
  ACER_CUSTOM_MAX,
  ACER_CUSTOM_MIN,
  ACER_PACKS,
  isValidAcerAmount,
} from "../src/features/wallet/config";
import {
  getWalletBalances,
  hasWalletTransaction,
  listWalletTransactions,
} from "../src/features/wallet/data";
import {
  ACER_PURCHASE_KIND,
  creditAcerPurchase,
  purchaseIdempotencyKey,
  resolvePurchaseFlash,
} from "../src/features/wallet/purchase";
import { getDb } from "../src/lib/db";
import { requireFixtureConsent } from "./lib/guard";

requireFixtureConsent("scripts/verify-acer-purchase.ts");

const PREFIX = "vap-";

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

async function makeUser(suffix: string): Promise<string> {
  const id = `${PREFIX}${suffix}`;
  await getDb()
    .insert(users)
    .values({
      id,
      name: `Buyer ${suffix}`,
      firstName: "Buyer",
      lastName: suffix,
      email: `${id}@example.invalid`,
      emailVerified: true,
      sex: "M",
    });
  return id;
}

/**
 * A `checkout.session.completed` payload shaped like the real one in the fields
 * the credit path reads. Cast rather than fully constructed: the Session type has
 * ~80 members and enumerating them would obscure which four actually matter.
 */
function session(over: {
  id: string;
  userId?: string | null;
  amountAcer?: number | null;
  amountTotal?: number | null;
  currency?: string | null;
  paymentStatus?: string;
}): Stripe.Checkout.Session {
  const amountAcer = over.amountAcer ?? 25;
  return {
    id: over.id,
    object: "checkout.session",
    payment_status: over.paymentStatus ?? "paid",
    currency: over.currency === undefined ? "usd" : over.currency,
    amount_total: over.amountTotal === undefined ? amountAcer * 100 : over.amountTotal,
    client_reference_id: over.userId ?? null,
    metadata:
      over.userId === null
        ? { kind: ACER_PURCHASE_KIND }
        : {
            kind: ACER_PURCHASE_KIND,
            userId: over.userId ?? "",
            amountAcer: String(amountAcer),
          },
  } as unknown as Stripe.Checkout.Session;
}

async function ledger(userId: string) {
  const { rows } = await listWalletTransactions(userId, { pageSize: 50 });
  return rows;
}

async function teardown(quiet = false) {
  const db = getDb();
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(like(users.id, `${PREFIX}%`));
  const ids = rows.map((r) => r.id);
  if (ids.length > 0) {
    await db.delete(walletTransactions).where(inArray(walletTransactions.userId, ids));
    await db.delete(users).where(inArray(users.id, ids));
  }
  if (!quiet) console.log(`removed ${ids.length} fixture users and their ledger rows`);
}

async function run() {
  await teardown(true);

  /* ── 1. the bounds are the server's rule ─────────────────────────── */
  console.log("\n1. amount validation (server-side rule)");
  for (const good of [ACER_CUSTOM_MIN, ACER_CUSTOM_MAX, ...ACER_PACKS]) {
    check(`accepts ${good}`, isValidAcerAmount(good));
  }
  for (const bad of [
    ACER_CUSTOM_MIN - 1,
    ACER_CUSTOM_MAX + 1,
    0,
    -10,
    10.5,
    0.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
  ]) {
    check(`refuses ${bad}`, !isValidAcerAmount(bad));
  }
  check(
    "every pack is inside the custom range (one rule, not two)",
    ACER_PACKS.every((p) => p >= ACER_CUSTOM_MIN && p <= ACER_CUSTOM_MAX),
  );

  /* ── 2. a settled session credits exactly one row ────────────────── */
  console.log("\n2. a settled session credits one purchase row");
  const buyer = await makeUser("buyer");
  const paid = session({ id: "cs_test_vap_paid", userId: buyer, amountAcer: 25 });

  eq_("first delivery credits", await creditAcerPurchase(paid), "credited");
  const afterFirst = await ledger(buyer);
  eq_("one row", afterFirst.length, 1);
  eq_("kind", afterFirst[0]?.kind, "purchase");
  eq_("status", afterFirst[0]?.status, "completed");
  eq_("asset", afterFirst[0]?.asset, "ACER");
  eq_("amount is the charge in minor units", afterFirst[0]?.amountMinor, 2500);
  eq_("reference keeps the session id", afterFirst[0]?.reference, "stripe:cs_test_vap_paid");
  eq_("idempotency key", afterFirst[0]?.idempotencyKey, "stripe:cs_test_vap_paid");
  eq_("memo keeps fiat amount + currency", afterFirst[0]?.memo, "USD 25.00");
  eq_("no admin author on a system credit", afterFirst[0]?.createdBy, null);
  eq_("balance", (await getWalletBalances(buyer)).ACER, 2500);

  /* ── 3. the same event twice credits once ────────────────────────── */
  console.log("\n3. at-least-once delivery credits exactly once");
  eq_("second delivery is a duplicate", await creditAcerPurchase(paid), "duplicate");
  eq_("third delivery too", await creditAcerPurchase(paid), "duplicate");
  eq_("still one row", (await ledger(buyer)).length, 1);
  eq_("balance unchanged", (await getWalletBalances(buyer)).ACER, 2500);

  /* ── 4. sessions that must not credit ────────────────────────────── */
  console.log("\n4. sessions that credit nothing");
  const before = (await ledger(buyer)).length;
  eq_(
    "unpaid session",
    await creditAcerPurchase(
      session({ id: "cs_test_vap_unpaid", userId: buyer, paymentStatus: "unpaid" }),
    ),
    "ignored",
  );
  eq_(
    "settled in the wrong currency",
    await creditAcerPurchase(
      session({ id: "cs_test_vap_eur", userId: buyer, currency: "eur", amountTotal: 2500 }),
    ),
    "ignored",
  );
  eq_(
    "zero total",
    await creditAcerPurchase(session({ id: "cs_test_vap_zero", userId: buyer, amountTotal: 0 })),
    "ignored",
  );
  eq_(
    "no buyer on the session",
    await creditAcerPurchase(session({ id: "cs_test_vap_nouser", userId: null })),
    "ignored",
  );
  eq_(
    "buyer deleted between checkout and settlement",
    await creditAcerPurchase(
      session({ id: "cs_test_vap_gone", userId: `${PREFIX}deleted-account` }),
    ),
    "ignored",
  );
  eq_("nothing was written", (await ledger(buyer)).length, before);

  /* ── 5. what was charged is what is credited ─────────────────────── */
  console.log("\n5. a repriced session credits the charge, not the request");
  const skew = session({ id: "cs_test_vap_skew", userId: buyer, amountAcer: 10, amountTotal: 700 });
  eq_("credited", await creditAcerPurchase(skew), "credited");
  const skewRow = (await ledger(buyer)).find((r) => r.idempotencyKey === "stripe:cs_test_vap_skew");
  eq_("credits the 7.00 charged, not the 10 requested", skewRow?.amountMinor, 700);
  eq_("memo says what was charged", skewRow?.memo, "USD 7.00");
  eq_("balance", (await getWalletBalances(buyer)).ACER, 3200);

  /* ── 6. client_reference_id is a fallback for the buyer ──────────── */
  console.log("\n6. buyer resolved from client_reference_id when metadata lacks it");
  const bare = {
    id: "cs_test_vap_bare",
    object: "checkout.session",
    payment_status: "paid",
    currency: "usd",
    amount_total: 500,
    client_reference_id: buyer,
    metadata: { kind: ACER_PURCHASE_KIND },
  } as unknown as Stripe.Checkout.Session;
  eq_("credited", await creditAcerPurchase(bare), "credited");
  eq_("balance", (await getWalletBalances(buyer)).ACER, 3700);

  /* ── 7. the page's "may take a moment" probe is per-user ─────────── */
  console.log("\n7. hasWalletTransaction is scoped to the asking user");
  const stranger = await makeUser("stranger");
  const key = purchaseIdempotencyKey("cs_test_vap_paid");
  eq_("the buyer sees their own credited session", await hasWalletTransaction(buyer, key), true);
  eq_("a stranger pasting the id sees nothing", await hasWalletTransaction(stranger, key), false);
  eq_(
    "an uncredited session reads as not-yet-landed",
    await hasWalletTransaction(buyer, purchaseIdempotencyKey("cs_test_vap_unpaid")),
    false,
  );
  eq_("the stranger's wallet is untouched", (await getWalletBalances(stranger)).ACER, 0);

  console.log("\n7b. the flash the page shows on the way back from Stripe");
  eq_("cancel", await resolvePurchaseFlash(buyer, "cancelled", undefined), "cancelled");
  eq_("no query", await resolvePurchaseFlash(buyer, undefined, undefined), null);
  eq_("junk", await resolvePurchaseFlash(buyer, "whatever", "cs_test_vap_paid"), null);
  eq_(
    "success on a credited session",
    await resolvePurchaseFlash(buyer, "success", "cs_test_vap_paid"),
    "success",
  );
  eq_(
    "success on a session that has not credited yet",
    await resolvePurchaseFlash(buyer, "success", "cs_test_vap_notyet"),
    "settling",
  );
  eq_(
    "success with a missing session id",
    await resolvePurchaseFlash(buyer, "success", undefined),
    "settling",
  );
  eq_(
    "success with a non-Stripe id is not looked up",
    await resolvePurchaseFlash(buyer, "success", "'; drop table wallet_transactions; --"),
    "settling",
  );
  eq_(
    "a stranger cannot read the buyer's success",
    await resolvePurchaseFlash(stranger, "success", "cs_test_vap_paid"),
    "settling",
  );

  /* ── 8. the purchase shows up in the runner's own history ────────── */
  console.log("\n8. the row renders in the cabinet history");
  const page = await listWalletTransactions(buyer, { pageSize: 20 });
  eq_("three purchases", page.rows.filter((r) => r.kind === "purchase").length, 3);
  eq_("total", page.total, 3);
  check(
    "every row carries a fiat memo for reconciliation",
    page.rows.every((r) => /^USD \d+\.\d{2}$/.test(r.memo ?? "")),
  );

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
