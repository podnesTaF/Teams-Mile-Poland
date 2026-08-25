import type Stripe from "stripe";

import { getAppUrl } from "@/lib/app-url";
import { localePath } from "@/lib/i18n/config";
import { getStripe } from "@/lib/stripe";

import { ACER_MINOR_UNITS, acerToMinor } from "./config";
import { hasWalletTransaction, recordWalletTransaction } from "./data";

/**
 * Buying ACER: the Checkout Session that takes the money, and the ledger write
 * that turns a settled session into credit.
 *
 * Both halves live here rather than in the server action because only one of
 * them is reachable from a browser. `createAcerPurchaseSession` is called by the
 * user-gated action (`actions.ts`); `creditAcerPurchase` is called by the Stripe
 * webhook route, which is a public endpoint authenticated by signature, not by
 * session — a `"use server"` module is the wrong home for it.
 *
 * ACER is **prepaid platform credit**, so every string this module puts in front
 * of a payer says exactly that. No token, stablecoin or crypto wording reaches
 * Stripe or the payer (PRD #44 framing decision) — that framing is what keeps
 * the product outside e-money and MiCA, and it is load-bearing rather than
 * cosmetic.
 *
 * **Deviation from PRD #44's frozen Contracts, surfaced on issue #49.** The
 * Contracts describe the wallet route's flash as `?purchase=success|cancelled`.
 * That is two states for three facts: paid-and-credited, paid-but-not-yet-
 * credited, and cancelled. The payer's browser is redirected by Stripe while the
 * credit arrives separately on the webhook, so "success" alone cannot tell the
 * middle case — which is the one the issue asks for ("paid-but-uncredited shows
 * a 'may take a moment' note"). Hence the extra `?session=<cs_…>` parameter and
 * the third `settling` state resolved by {@link resolvePurchaseFlash}.
 */

/**
 * What marks a Checkout Session as an ACER top-up.
 *
 * The webhook branches on this and returns before the legacy team-checkout
 * path, so the two flows never see each other's sessions. Legacy sessions carry
 * `metadata.flow` and no `kind` at all, so the discriminator cannot collide.
 */
export const ACER_PURCHASE_KIND = "acer_purchase";

/**
 * The one currency ACER is sold in. 1 ACER = 1 USD by definition, which makes
 * USD cents and ledger minor units the *same number* — the credit is
 * `amount_total`, with no conversion step to get wrong.
 */
export const PURCHASE_CURRENCY = "usd";

/**
 * The product name on the Stripe page, the receipt and the card statement
 * descriptor's line item — deliberately not an i18n key.
 *
 * It is the same phrase the Terms of Use define ("ACER credit and the Wallet"),
 * and a payer disputing a charge, an accountant reconciling it and a Polish
 * lawyer reading the terms should all see one identical name for the thing that
 * was sold. The line item's *description* is localised; the name is the anchor.
 */
export const ACER_PRODUCT_NAME = "Ace Battle account credit";

/**
 * Whether card purchases are switched on.
 *
 * Issue #49 carries a launch condition the code has to hold rather than a person
 * remember: *"purchases must not go live before the #46 legal copy has passed
 * Polish counsel review."* So the whole affordance is off unless
 * `ACER_PURCHASE_ENABLED=1` is set — the page renders no purchase form and the
 * action refuses — which makes going live a deliberate config change on the day
 * counsel signs off, and makes merging this slice safe before then.
 *
 * Deliberately **not** `NEXT_PUBLIC_`: a flag a browser can read is a flag a
 * browser can be wrong about, and the server has to be the one that decides
 * whether it will take money.
 */
export function isAcerPurchaseEnabled(): boolean {
  return process.env.ACER_PURCHASE_ENABLED === "1";
}

/**
 * The ledger key for a session's credit.
 *
 * Stripe delivers `checkout.session.completed` **at least** once — a redelivery,
 * a manual resend from the dashboard, or our own 500 followed by their retry all
 * arrive as the same event. The partial unique index on `idempotency_key` is
 * what turns the second arrival into a no-op, so retrying is safe by
 * construction and nothing has to remember to check first.
 */
export function purchaseIdempotencyKey(sessionId: string): string {
  return `stripe:${sessionId}`;
}

/**
 * Stripe Checkout's UI language for one of our locales.
 *
 * Stripe Checkout has no Ukrainian localisation, and `"auto"` would fall back to
 * whatever the browser asks for — which for a Ukrainian visitor can resolve to
 * Russian. Sending `ua` to English is a deliberate choice of a neutral language
 * over a wrong one.
 */
function checkoutLocale(locale: string): Stripe.Checkout.SessionCreateParams.Locale {
  return locale === "pl" ? "pl" : "en-GB";
}

/** Where Stripe sends the payer back, in the language they were shopping in. */
function walletUrl(locale: string, query: string): string {
  return `${getAppUrl()}${localePath(locale, "/wallet")}?${query}`;
}

/** The localised Stripe-facing copy, resolved by the caller from the `wallet` catalog. */
export type AcerCheckoutCopy = {
  /** Line-item description under {@link ACER_PRODUCT_NAME}. */
  description: string;
  /** Replaces Stripe's default terms sentence; carries the 14-day withdrawal consent. */
  consent: string;
};

export type AcerCheckoutInput = {
  userId: string;
  email: string;
  amountAcer: number;
  locale: string;
  copy: AcerCheckoutCopy;
};

/**
 * Create the Checkout Session for a top-up and return its hosted URL.
 *
 * Three parameters are load-bearing and worth not "tidying away":
 *
 * - `payment_method_types: ["card"]` — cards settle synchronously. Stripe's
 *   automatic methods include ones that settle days later, which would put a
 *   `pending` row in an append-only ledger that can never be updated to
 *   `completed`. Card-only keeps "paid" and "credited" one step apart instead of
 *   three.
 * - `adaptive_pricing: { enabled: false }` — with it on, Stripe may present and
 *   charge in the payer's local currency, and `amount_total` would stop being
 *   USD cents. The whole 1 ACER = 1 USD = 100 minor units identity rests on this
 *   being off.
 * - `consent_collection.terms_of_service: "required"` — the payer must tick the
 *   terms box before paying, which is where the 14-day withdrawal consent is
 *   given. **This requires a Terms of Service URL in the Stripe Dashboard**
 *   (Settings → Public details); without one Stripe rejects session creation,
 *   and the action reports the purchase as unavailable rather than taking money
 *   without consent.
 *
 * No registration-style pending row is written here. The ledger's only purchase
 * row is the one the webhook writes on settlement, keyed by the session — a row
 * written now would either claim the same key (and block the real credit) or
 * strand a `pending` row forever when the payer walks away at Stripe.
 */
export async function createAcerPurchaseSession({
  userId,
  email,
  amountAcer,
  locale,
  copy,
}: AcerCheckoutInput): Promise<string> {
  const stripe = getStripe();

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    locale: checkoutLocale(locale),
    payment_method_types: ["card"],
    adaptive_pricing: { enabled: false },
    customer_email: email,
    // The payer's own account, in Stripe's canonical field as well as in
    // metadata: it is what a support agent reads off a dashboard payment.
    client_reference_id: userId,
    success_url: walletUrl(locale, "purchase=success&session={CHECKOUT_SESSION_ID}"),
    cancel_url: walletUrl(locale, "purchase=cancelled"),
    consent_collection: { terms_of_service: "required" },
    custom_text: { terms_of_service_acceptance: { message: copy.consent } },
    // The webhook reads all three. `amountAcer` is a cross-check against
    // `amount_total`, not the source of the credit — what was charged is what
    // gets credited.
    metadata: {
      kind: ACER_PURCHASE_KIND,
      userId,
      amountAcer: String(amountAcer),
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: PURCHASE_CURRENCY,
          unit_amount: acerToMinor(amountAcer),
          product_data: {
            name: ACER_PRODUCT_NAME,
            description: copy.description,
          },
        },
      },
    ],
  });

  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL.");
  }

  return session.url;
}

/**
 * What a webhook delivery did to the ledger. All three are successful outcomes
 * for the caller — only a thrown error means "retry me".
 */
export type AcerCreditOutcome =
  /** The credit is in the ledger because this delivery put it there. */
  | "credited"
  /** The credit was already in the ledger — a redelivery. Nothing to do. */
  | "duplicate"
  /** Not a settled ACER purchase (unpaid, or malformed beyond crediting). */
  | "ignored";

/**
 * Credit a settled ACER Checkout Session to its buyer's wallet.
 *
 * Exactly one `purchase` row per session, keyed
 * {@link purchaseIdempotencyKey} — the index, not a check-then-insert, is what
 * makes a redelivered event credit once. The fiat side is kept for
 * reconciliation: `reference` carries the session id (the handle that finds the
 * payment in Stripe) and `memo` the amount and currency actually charged, as a
 * language-neutral token rather than a sentence, because a memo is stored once
 * and read by whoever opens the wallet in whatever language they read the site
 * in.
 *
 * Throwing is the correct response to a database failure: Stripe retries, and
 * the retry is idempotent. Returning `"ignored"` is for the cases a retry cannot
 * fix.
 */
export async function creditAcerPurchase(
  session: Stripe.Checkout.Session,
): Promise<AcerCreditOutcome> {
  const userId = session.metadata?.userId ?? session.client_reference_id;
  if (!userId) {
    console.error(`[wallet] ACER session ${session.id} carries no user; nothing credited.`);
    return "ignored";
  }

  // Card-only sessions are paid by the time this event fires. Anything else is
  // a session that never settled, and crediting it would be minting money.
  if (session.payment_status !== "paid") return "ignored";

  const paidMinor = session.amount_total;
  if (session.currency !== PURCHASE_CURRENCY || !paidMinor || paidMinor <= 0) {
    // Unreachable while the session is created above (usd, adaptive pricing
    // off) — loud rather than silent because the payer has paid and is owed an
    // admin credit if it ever happens.
    console.error(
      `[wallet] ACER session ${session.id} settled as ${paidMinor} ${session.currency} — not creditable; credit ${userId} by hand.`,
    );
    return "ignored";
  }

  // 1 ACER = 1 USD = 100 minor units, so the charge *is* the credit. Metadata
  // is only the cross-check; a mismatch would mean the session was tampered
  // with or repriced, and what the payer actually paid is the honest amount.
  const expected = acerToMinor(Number(session.metadata?.amountAcer ?? Number.NaN));
  if (Number.isFinite(expected) && expected !== paidMinor) {
    console.error(
      `[wallet] ACER session ${session.id} charged ${paidMinor} minor but requested ${expected}; crediting the charge.`,
    );
  }

  let row;
  try {
    row = await recordWalletTransaction({
      userId,
      asset: "ACER",
      amountMinor: paidMinor,
      kind: "purchase",
      reference: purchaseIdempotencyKey(session.id),
      memo: fiatMemo(paidMinor, session.currency),
      idempotencyKey: purchaseIdempotencyKey(session.id),
    });
  } catch (error) {
    // The buyer's account was deleted between checkout and settlement, so the
    // ledger's foreign key has nowhere to point. There is no wallet left to
    // credit and no retry that changes that, so this must not answer 500 — a
    // permanent failure re-delivered forever is noise that hides real ones.
    if (isMissingUser(error)) {
      console.error(
        `[wallet] ACER session ${session.id} settled but user ${userId} no longer exists; nothing credited.`,
      );
      return "ignored";
    }
    throw error;
  }

  return row ? "credited" : "duplicate";
}

/**
 * Postgres foreign-key violation (23503) — here, a buyer who no longer exists.
 *
 * The `cause` walk is not defensive padding: Drizzle wraps the driver error in a
 * `DrizzleQueryError` whose own `code` is undefined, so checking only the top
 * level silently never matches and the 500-retry loop this guards against comes
 * straight back.
 */
function isMissingUser(error: unknown): boolean {
  for (let e: unknown = error; e; e = (e as { cause?: unknown }).cause) {
    if (typeof e !== "object") return false;
    if ((e as { code?: unknown }).code === "23503") return true;
  }
  return false;
}

/**
 * The fiat side of the row, for reconciliation: `"USD 25.00"`. Formatted with
 * neither `Intl` nor a locale on purpose — a stored string has no reader's
 * language, and an accountant matching it against a Stripe payout needs one
 * stable shape.
 */
function fiatMemo(amountMinor: number, currency: string): string {
  return `${currency.toUpperCase()} ${(amountMinor / ACER_MINOR_UNITS).toFixed(2)}`;
}

/**
 * Stripe Checkout Session ids, as they arrive in `?session=`. Anything else is
 * not looked up — the value comes off a URL a reader can edit.
 */
const SESSION_ID = /^cs_[A-Za-z0-9_]{1,240}$/;

/** What the wallet says about the trip to Stripe the reader has just come back from. */
export type PurchaseFlash = "success" | "settling" | "cancelled";

/**
 * Read Stripe's return channel and say what actually happened.
 *
 * "Paid" and "credited" are two facts, seconds apart: the payer is redirected
 * back by their own browser while the credit arrives on the webhook. So
 * `?purchase=success` is not evidence of a credit — the ledger is. When the
 * session's row is already there this is a plain success; when it is not, the
 * reader is told it may take a moment, which is the message that stops them
 * buying the same amount twice.
 *
 * The session id is only ever used to look up a row **belonging to this user**,
 * so a pasted or guessed id reveals nothing about anyone else's payment.
 */
export async function resolvePurchaseFlash(
  userId: string,
  purchase: string | undefined,
  session: string | undefined,
): Promise<PurchaseFlash | null> {
  if (purchase === "cancelled") return "cancelled";
  if (purchase !== "success") return null;
  if (!session || !SESSION_ID.test(session)) return "settling";
  return (await hasWalletTransaction(userId, purchaseIdempotencyKey(session)))
    ? "success"
    : "settling";
}
