"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { users } from "@/db/schema";
import { getDb } from "@/lib/db";
import { acerToMinor } from "@/features/wallet/config";
import { parseWalletPage, recordWalletTransaction } from "@/features/wallet/data";

import { adminPath, requireAdmin, safeLocale } from "./action-helpers";
import { WALLET_ASSET_LABEL } from "./wallet-copy";
import { isWalletTxId } from "./wallet-data";
import { adjustmentAmountOf, assetOf, reasonOf, reasonRequired } from "./wallet-form";
import { creditAcerBulk } from "./wallet-grant";
import { reverseRows } from "./wallet-reverse";

/**
 * The admin write path into the wallet ledger: a manual credit or debit, the
 * reversal that corrects a wrong row, and the bulk grant that credits many
 * accounts at once from the users list.
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
 * flow of their own. The form is read by `wallet-form.ts`, shared with the
 * treasury panel's twin action so both refuse the same typos the same way.
 */
export async function adjustWalletBalance(formData: FormData) {
  const locale = safeLocale(formData.get("locale"));
  const admin = await requireAdmin(locale, "edit");

  const userId = String(formData.get("id") ?? "");
  if (!userId) back(locale, formData, "", "No user specified.");

  const asset = assetOf(formData);
  if (!asset) back(locale, formData, userId, "Pick an asset to adjust.");

  const amount = adjustmentAmountOf(formData);
  if (!amount.ok) back(locale, formData, userId, amount.error);

  const reason = reasonOf(formData);
  if (!reason) back(locale, formData, userId, reasonRequired("adjustment"));

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
    amountMinor: acerToMinor(amount.amount),
    kind: amount.amount > 0 ? "admin_credit" : "admin_debit",
    memo: reason,
    createdBy: admin.id,
  });

  back(
    locale,
    formData,
    userId,
    `${amount.amount > 0 ? "Credited" : "Debited"} ${Math.abs(amount.amount)} ${WALLET_ASSET_LABEL[asset]} — recorded against your account.`,
  );
}

/**
 * Reverse a transaction: append an offsetting row of `kind: "reversal"` that
 * points at the original through `reverses_id`. Nothing is edited or deleted.
 *
 * The rules — once, only while `completed`, never a reversal itself, and both
 * legs of a treasury transfer together — live in `wallet-reverse.ts`, shared
 * with the treasury panel. An `alreadyReversed` outcome is reported as such
 * rather than as a failure, because the ledger is in the state the admin wanted.
 */
export async function reverseWalletTransaction(formData: FormData) {
  const locale = safeLocale(formData.get("locale"));
  const admin = await requireAdmin(locale, "edit");

  const userId = String(formData.get("id") ?? "");
  const txId = String(formData.get("txId") ?? "");
  if (!txId || !isWalletTxId(txId)) back(locale, formData, userId, "No transaction specified.");

  const reason = reasonOf(formData);
  if (!reason) back(locale, formData, userId, reasonRequired("reversal"));

  const outcome = await reverseRows({ txId, reason, adminId: admin.id });
  // Redirect to the row's own owner, not to whoever's page the form was posted
  // from: they are the same page in every real flow, and if they ever are not,
  // the admin should land on the history that just changed. A team-owned row
  // has no user page; the posting page is the fallback.
  const ownerPage = outcome.owner?.userId ?? userId;
  if (!outcome.ok) back(locale, formData, ownerPage, outcome.error);
  if (!outcome.reversed) {
    back(locale, formData, ownerPage, "That transaction has already been reversed.");
  }
  back(
    locale,
    formData,
    ownerPage,
    outcome.legs === 2
      ? "Transfer reversed — both legs are offset, on this wallet and on the team's treasury, and everything stays in the history."
      : "Transaction reversed — both rows stay in the history and net to zero.",
  );
}

/* ── bulk grant ─────────────────────────────────────────────────────── */

/**
 * The users list's own view state, as the bulk bar carries it back.
 *
 * Only the params that list page actually reads survive the round trip: the
 * value is re-serialised from an allow-list rather than pasted into the
 * redirect, so a hand-edited `listQuery` cannot smuggle anything into the URL
 * the admin lands on — and `msg` is always ours, never the form's.
 */
const LIST_PARAMS = ["q", "verified", "participation", "registered", "complete", "sort", "page"];

/**
 * Back to the users list with a sentence, on the filters, sort and page the
 * admin was looking at.
 *
 * A bulk grant is chosen by eye from a filtered, sorted, paged list; landing on
 * the unfiltered first page afterwards would lose exactly the view that made
 * the selection possible, in the flow where the next thing to do is usually
 * select the next batch.
 */
function backToList(locale: string, formData: FormData, msg: string): never {
  const carried = new URLSearchParams(String(formData.get("listQuery") ?? ""));
  const query = new URLSearchParams();
  for (const key of LIST_PARAMS) {
    const value = carried.get(key);
    if (value) query.set(key, value);
  }
  query.set("msg", msg);
  revalidatePath(adminPath(locale, "/users"));
  redirect(adminPath(locale, `/users?${query}`));
}

/**
 * Credit whole ACER to every ticked account in one act, with one mandatory
 * reason recorded against every row.
 *
 * The gate, the redirect and the copy live here; the validation and the
 * transaction live in `wallet-grant.ts`, which holds no session and can
 * therefore be driven by a verification script. `requireAdmin(locale, "edit")`
 * is re-checked even though the bar only renders for `edit` — the form is HTML
 * the browser can be made to post by hand, and a view-only or check-in admin
 * must be refused by the server, not by the absence of a button.
 *
 * Amounts, reasons and the id list all come back as sentences on the list's
 * `?msg=` channel rather than as thrown errors: a mistyped amount is a thing to
 * correct, not a crash. Nothing partial is ever written — see `creditAcerBulk`.
 */
export async function creditWalletBulk(formData: FormData) {
  const locale = safeLocale(formData.get("locale"));
  const admin = await requireAdmin(locale, "edit");

  const raw = String(formData.get("amount") ?? "").trim();
  const outcome = await creditAcerBulk({
    userIds: formData.getAll("userIds").map((id) => String(id)),
    // `Number("")` is 0 and `Number("x")` is NaN; both are refused downstream,
    // so an empty or nonsense field reports the same sentence as a bad number.
    amountAcer: raw === "" ? Number.NaN : Number(raw),
    reason: String(formData.get("reason") ?? ""),
    batchId: String(formData.get("batchId") ?? ""),
    adminId: admin.id,
  });

  if (!outcome.ok) backToList(locale, formData, outcome.error);

  const { credited, recipients } = outcome;
  const amount = Number(raw);

  if (credited === 0) {
    backToList(
      locale,
      formData,
      "That grant is already recorded — nothing was credited a second time.",
    );
  }
  // A partial count cannot happen through the UI: one batch id is minted per
  // render and every row of it is written in one transaction. Reported honestly
  // anyway rather than rounded up to "credited", because the alternative is a
  // sentence that claims more than the ledger holds.
  if (credited < recipients) {
    backToList(
      locale,
      formData,
      `Credited ${amount} ACER to ${credited} of ${recipients} people — the rest were already credited under this grant.`,
    );
  }
  backToList(
    locale,
    formData,
    `Credited ${amount} ACER to ${credited} ${credited === 1 ? "person" : "people"} — recorded against your account.`,
  );
}
