"use client";

import { useEffect } from "react";

import { type CheckoutKind, completeCheckout } from "@/lib/analytics";

/**
 * Render on the page Stripe Checkout's `success_url` lands on. Reports the
 * checkout that `beginCheckout` remembered as a GA4 `purchase`, once per
 * checkout — a refresh finds nothing left to report.
 *
 * It reports the return from Stripe, not the webhook's fulfilment: a payment
 * that later fails reconciliation still counts here. Stripe is the ledger.
 */
export function CheckoutReturn({ kind }: { kind: CheckoutKind }) {
  useEffect(() => {
    completeCheckout(kind);
  }, [kind]);
  return null;
}
