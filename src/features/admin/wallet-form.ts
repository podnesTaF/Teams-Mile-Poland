import { WALLET_ASSETS, type WalletAsset } from "@/db/schema";

import { MAX_ADJUSTMENT_ACER, MAX_REASON_LENGTH } from "./wallet-data";

/**
 * How the admin wallet forms are read — shared by the runner panel's actions
 * (`wallet-actions.ts`) and the treasury panel's (`treasury-actions.ts`), so a
 * manual credit to a runner and to a team are refused for exactly the same
 * typos with exactly the same sentences. Plain module: a `"use server"` file
 * may export only async functions, which is why these are not in either.
 */

/** The mandatory reason, or `null` when the form did not carry a usable one. */
export function reasonOf(formData: FormData): string | null {
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason || reason.length > MAX_REASON_LENGTH) return null;
  return reason;
}

export function assetOf(formData: FormData): WalletAsset | null {
  const value = String(formData.get("asset") ?? "");
  return WALLET_ASSETS.includes(value as WalletAsset) ? (value as WalletAsset) : null;
}

/**
 * The signed whole-ACER amount of a manual adjustment, or the sentence that
 * refuses it. Fractions are refused rather than rounded — "0.5 ACER" is a typo
 * far more often than an intention — and zero would change nothing.
 */
export function adjustmentAmountOf(
  formData: FormData,
): { ok: true; amount: number } | { ok: false; error: string } {
  const raw = String(formData.get("amount") ?? "").trim();
  const amount = Number(raw);
  if (!raw || !Number.isInteger(amount)) {
    return { ok: false, error: "Enter the amount as a whole number of ACER — negative to debit." };
  }
  if (amount === 0) return { ok: false, error: "An adjustment of 0 would change nothing." };
  if (Math.abs(amount) > MAX_ADJUSTMENT_ACER) {
    return {
      ok: false,
      error: `That is larger than a manual adjustment can be (±${MAX_ADJUSTMENT_ACER} ACER). Check the amount.`,
    };
  }
  return { ok: true, amount };
}

/** The sentence a missing reason gets, worded for the act it was missing from. */
export function reasonRequired(act: "adjustment" | "reversal"): string {
  return act === "adjustment"
    ? `Give a reason for the adjustment (up to ${MAX_REASON_LENGTH} characters) — it is what makes it auditable.`
    : `Give a reason for the reversal (up to ${MAX_REASON_LENGTH} characters) — the correction is part of the audit trail.`;
}
