"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { users, WALLET_ASSETS, type WalletAsset } from "@/db/schema";
import { getDb } from "@/lib/db";
import { acerToMinor } from "@/features/wallet/config";
import { parseWalletPage, recordWalletTransaction } from "@/features/wallet/data";

import { adminPath, requireAdmin, safeLocale } from "./action-helpers";
import { WALLET_ASSET_LABEL } from "./wallet-copy";
import {
  getWalletTransaction,
  isWalletTxId,
  MAX_ADJUSTMENT_ACER,
  MAX_REASON_LENGTH,
} from "./wallet-data";

/**
 * The admin write path into the wallet ledger: a manual credit or debit, and
 * the reversal that corrects a wrong row.
 *
 * Both go through `recordWalletTransaction` — the ledger's single writer — so
 * nothing here issues `UPDATE` or `DELETE`. **A correction is a new row**, an
 * offsetting `reversal` pointing at the original through `reverses_id`: both
 * rows stay visible in both histories and net to zero, which is the whole point
 * of an append-only ledger. Every row records the acting admin in `created_by`
 * and carries the mandatory reason in `memo`, so an adjustment stays explainable
 * long after the shift that made it.
 *
 * Refusals travel back on the user detail page's `?msg=` channel, the same way
 * its registration action reports itself — a validation failure is a sentence
 * above the panel, never a crash.
 */

/**
 * Back to the user's detail page with a sentence for the admin, on the page of
 * the ledger they were reading.
 *
 * `wpage` is carried back because the panel's history is paginated: reversing a
 * row found on page 3 and landing on page 1 loses the admin's place in exactly
 * the flow where they are most likely to have another row to fix. No `#wallet`
 * fragment, though — the sentence renders at the top of the page, and jumping
 * past it would hide the outcome of the press.
 */
function back(locale: string, form: FormData, userId: string, msg: string): never {
  const suffix = userId ? `/${userId}` : "";
  const page = parseWalletPage(String(form.get("wpage") ?? ""));
  const query = new URLSearchParams({ msg });
  if (page > 1) query.set("wpage", String(page));
  revalidatePath(adminPath(locale, `/users${suffix}`));
  redirect(adminPath(locale, `/users${suffix}?${query}`));
}

/** The mandatory reason, or `null` when the form did not carry a usable one. */
function reasonOf(formData: FormData): string | null {
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason || reason.length > MAX_REASON_LENGTH) return null;
  return reason;
}

function assetOf(formData: FormData): WalletAsset | null {
  const value = String(formData.get("asset") ?? "");
  return WALLET_ASSETS.includes(value as WalletAsset) ? (value as WalletAsset) : null;
}

/**
 * Credit or debit a user's balance by hand, with a mandatory reason.
 *
 * The amount is **signed whole ACER**: positive credits (`admin_credit`),
 * negative debits (`admin_debit`). Fractions are refused rather than rounded —
 * "0.5 ACER" is a typo far more often than it is an intention, and silently
 * turning it into 50 minor units hides that.
 *
 * Deliberately carries no idempotency key: two identical adjustments entered on
 * purpose are two real adjustments, and the ledger must hold both. This is also
 * the interim channel for ad-hoc rewards (sponsor attraction) until those get a
 * flow of their own.
 */
export async function adjustWalletBalance(formData: FormData) {
  const locale = safeLocale(formData.get("locale"));
  const admin = await requireAdmin(locale, "edit");

  const userId = String(formData.get("id") ?? "");
  if (!userId) back(locale, formData, "", "No user specified.");

  const asset = assetOf(formData);
  if (!asset) back(locale, formData, userId, "Pick an asset to adjust.");

  const raw = String(formData.get("amount") ?? "").trim();
  const amount = Number(raw);
  if (!raw || !Number.isInteger(amount)) {
    back(
      locale,
      formData,
      userId,
      "Enter the amount as a whole number of ACER — negative to debit.",
    );
  }
  if (amount === 0) back(locale, formData, userId, "An adjustment of 0 would change nothing.");
  if (Math.abs(amount) > MAX_ADJUSTMENT_ACER) {
    back(
      locale,
      formData,
      userId,
      `That is larger than a manual adjustment can be (±${MAX_ADJUSTMENT_ACER} ACER). Check the amount.`,
    );
  }

  const reason = reasonOf(formData);
  if (!reason) {
    back(
      locale,
      formData,
      userId,
      `Give a reason for the adjustment (up to ${MAX_REASON_LENGTH} characters) — it is what makes it auditable.`,
    );
  }

  // Checked before the insert so a stale detail page reports the deleted
  // account rather than surfacing a foreign-key violation.
  const [target] = await getDb()
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!target) back(locale, formData, "", "User not found.");

  await recordWalletTransaction({
    userId,
    asset,
    amountMinor: acerToMinor(amount),
    kind: amount > 0 ? "admin_credit" : "admin_debit",
    memo: reason,
    createdBy: admin.id,
  });

  back(
    locale,
    formData,
    userId,
    `${amount > 0 ? "Credited" : "Debited"} ${Math.abs(amount)} ${WALLET_ASSET_LABEL[asset]} — recorded against your account.`,
  );
}

/**
 * Correct a ledger row by appending its mirror image: same user, same asset,
 * the negated amount, `kind: "reversal"`, `reverses_id` pointing at the
 * original. Nothing is edited and nothing is deleted — the mistake and its
 * correction both stay in the history, netting to zero.
 *
 * Unlike a manual adjustment this **is** keyed (`reversal:<txId>`): a row has
 * exactly one correction, and the partial unique index on `idempotency_key`
 * makes a double submit — or two admins on the same row — a no-op instead of an
 * over-correction that pushes the balance negative. `recordWalletTransaction`
 * returning `null` is that case, and it is reported as "already reversed"
 * rather than as a failure, because the ledger is in the state the admin wanted.
 *
 * Two rows are refused rather than reversed. A `failed` or `pending` row counts
 * toward no balance, so offsetting it would *create* the error it looks like it
 * fixes; and a reversal is not itself reversible — undoing a correction is a
 * fresh decision, so it goes in as a manual credit or debit with its own reason.
 */
export async function reverseWalletTransaction(formData: FormData) {
  const locale = safeLocale(formData.get("locale"));
  const admin = await requireAdmin(locale, "edit");

  const userId = String(formData.get("id") ?? "");
  const txId = String(formData.get("txId") ?? "");
  if (!txId || !isWalletTxId(txId)) back(locale, formData, userId, "No transaction specified.");

  const reason = reasonOf(formData);
  if (!reason) {
    back(
      locale,
      formData,
      userId,
      `Give a reason for the reversal (up to ${MAX_REASON_LENGTH} characters) — the correction is part of the audit trail.`,
    );
  }

  const original = await getWalletTransaction(txId);
  if (!original) back(locale, formData, userId, "That transaction no longer exists.");
  if (original.kind === "reversal") {
    back(
      locale,
      formData,
      userId,
      "A correction cannot itself be reversed. Enter a manual credit or debit instead, with its own reason.",
    );
  }
  if (original.status !== "completed") {
    back(
      locale,
      formData,
      userId,
      `Only a completed transaction can be reversed — this one is ${original.status} and counts toward no balance.`,
    );
  }

  const reversal = await recordWalletTransaction({
    userId: original.userId,
    asset: original.asset,
    amountMinor: -original.amountMinor,
    kind: "reversal",
    memo: reason,
    createdBy: admin.id,
    reversesId: original.id,
    idempotencyKey: `reversal:${original.id}`,
  });

  // Redirect to the row's own owner, not to whoever's page the form was posted
  // from: they are the same page in every real flow, and if they ever are not,
  // the admin should land on the history that just changed.
  if (!reversal) {
    back(locale, formData, original.userId, "That transaction has already been reversed.");
  }
  back(
    locale,
    formData,
    original.userId,
    "Transaction reversed — both rows stay in the history and net to zero.",
  );
}
