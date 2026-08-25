"use server";

import { getLocale, getTranslations } from "next-intl/server";

import { getUser, isAdmin, isProfileComplete } from "@/lib/auth/user-session";

import { isValidAcerAmount } from "./config";
import { createAcerPurchaseSession, isAcerPurchaseEnabled } from "./purchase";

/**
 * The one write the cabinet wallet offers: start a card purchase of ACER.
 *
 * Everything else on the wallet page is server-rendered read-only, and the
 * ledger's writers are the check-in accruals and the admin panel. This action
 * takes no money and moves no ACER — it hands back a Stripe URL, and the credit
 * only exists once the webhook sees the session settle.
 *
 * **Deviation from PRD #44's frozen Contracts, surfaced on issue #49.** The
 * Contracts give the signature as `createAcerCheckout({ amountAcer }) → { url }`.
 * A bare `url` leaves only `throw` for the refusals issue #49 explicitly
 * requires ("out-of-bounds and fractional inputs are rejected with a clear
 * message"; "a guest attempting to buy round-trips through the gate back to the
 * wallet"), and a thrown server-action error reaches a client as an opaque
 * digest — no message, no gate hop. So the return is the result union below,
 * matching `registerForEvent` in `src/features/event-registration/actions.ts`,
 * which is this repo's established shape for exactly this problem. The happy
 * path still returns the url the Contracts promise.
 */

/**
 * Why a purchase could not be started.
 *
 * A **code**, not a sentence. This is the money screen, and its copy has to
 * exist in pl/en/ua like every other public string — so the island maps the code
 * to a translated message from the `wallet` catalog. A server-authored English
 * string would be the one untranslatable line on the page.
 */
export type AcerCheckoutRefusal =
  /** Not signed in — the island sends them through the gate chain and back. */
  | "auth"
  | "verify"
  | "profile"
  /** Not a whole number of ACER inside the permitted range. */
  | "amount"
  /** Stripe is unconfigured or refused to open a session. */
  | "unavailable";

export type AcerCheckoutResult =
  | { ok: true; url: string }
  | { ok: false; reason: AcerCheckoutRefusal };

/**
 * Validate an amount and open a Stripe Checkout Session for it.
 *
 * The gate chain is re-checked here and not merely on the page: the page's
 * redirect is what a browser sees, but an action is an HTTP endpoint, and a
 * guest, an unverified account or a half-finished profile can all POST to it
 * directly. The amount is re-checked for the same reason — the form's `min`,
 * `max` and `step` are a courtesy to the person typing, and this is the rule.
 */
export async function createAcerCheckout({
  amountAcer,
}: {
  amountAcer: number;
}): Promise<AcerCheckoutResult> {
  // The launch gate first: before Polish counsel signs off on the #46 legal
  // copy there is no lawful purchase to start, whatever the caller asks for.
  if (!isAcerPurchaseEnabled()) return { ok: false, reason: "unavailable" };

  const user = await getUser();
  if (!user) return { ok: false, reason: "auth" };
  // Admin-only while the wallet is in testing, matching the page gate.
  if (!isAdmin(user)) return { ok: false, reason: "unavailable" };
  if (!user.emailVerified) return { ok: false, reason: "verify" };
  if (!isProfileComplete(user)) return { ok: false, reason: "profile" };

  if (!isValidAcerAmount(amountAcer)) return { ok: false, reason: "amount" };

  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "wallet" });

  try {
    const url = await createAcerPurchaseSession({
      userId: user.id,
      email: user.email,
      amountAcer,
      locale,
      // Stripe-facing copy is resolved here, where a request locale exists, and
      // passed down: the purchase module is also called from the webhook, which
      // has no locale at all.
      copy: {
        description: t("purchase.stripe.description", { amount: amountAcer }),
        consent: t("purchase.stripe.consent"),
      },
    });
    return { ok: true, url };
  } catch (error) {
    // A missing key, a Stripe outage, or — the likely one on first deploy — no
    // Terms of Service URL in the Stripe Dashboard, which is what
    // `consent_collection` requires. Loud in the log, one sentence to the payer.
    console.error(`[wallet] ACER checkout for ${user.id} could not be opened:`, error);
    return { ok: false, reason: "unavailable" };
  }
}
