"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { userTeams } from "@/db/schema/user-teams";
import { acerToMinor } from "@/features/wallet/config";
import { parseWalletPage, recordWalletTransaction } from "@/features/wallet/data";
import { getDb } from "@/lib/db";

import { adminPath, requireAdmin, safeLocale } from "./action-helpers";
import { WALLET_ASSET_LABEL } from "./wallet-copy";
import { isWalletTxId } from "./wallet-data";
import { adjustmentAmountOf, assetOf, reasonOf, reasonRequired } from "./wallet-form";
import { reverseRows } from "./wallet-reverse";

/**
 * The admin write path into a team's treasury (ADR 0012): a manual credit or
 * debit — the **grant** the owner asked for — and the reversal that corrects a
 * wrong row. The twin of `wallet-actions.ts` for a team owner: same single
 * writer, same mandatory reason, same `created_by` audit, same `?msg=`
 * channel, landing on `/admin/teams/<slug>#treasury` instead of the user page.
 *
 * Not folded into `wallet-actions.ts` on purpose: its `back()` is the user
 * page's, and an owner switch inside a redirect helper is how an admin ends up
 * on the wrong ledger after a press.
 */

function back(locale: string, form: FormData, slug: string, msg: string): never {
  const page = parseWalletPage(String(form.get("wpage") ?? ""));
  const query = new URLSearchParams({ msg });
  if (page > 1) query.set("wpage", String(page));
  revalidatePath(adminPath(locale, `/teams/${slug}`));
  redirect(adminPath(locale, `/teams/${slug}?${query}#treasury`));
}

/**
 * Credit (positive) or debit (negative) whole ACER to a team's treasury, with a
 * mandatory reason. Deliberately un-keyed, like the runner panel's adjustment:
 * two identical grants entered on purpose are two real grants.
 */
export async function adjustTreasuryBalance(formData: FormData) {
  const locale = safeLocale(formData.get("locale"));
  const admin = await requireAdmin(locale, "edit");

  const slug = String(formData.get("teamSlug") ?? "");
  const teamId = String(formData.get("teamId") ?? "");
  if (!slug || !teamId) redirect(adminPath(locale, "/teams?msg=No+team+specified."));

  const asset = assetOf(formData);
  if (!asset) back(locale, formData, slug, "Pick an asset to adjust.");

  const amount = adjustmentAmountOf(formData);
  if (!amount.ok) back(locale, formData, slug, amount.error);

  const reason = reasonOf(formData);
  if (!reason) back(locale, formData, slug, reasonRequired("adjustment"));

  // Checked before the insert so a stale detail page reports the dissolved team
  // rather than crediting a treasury nobody can reach any more.
  const [team] = await getDb()
    .select({ id: userTeams.id })
    .from(userTeams)
    .where(eq(userTeams.id, teamId))
    .limit(1);
  if (!team) redirect(adminPath(locale, "/teams?msg=That+team+no+longer+exists."));

  await recordWalletTransaction({
    teamId,
    asset,
    amountMinor: acerToMinor(amount.amount),
    kind: amount.amount > 0 ? "admin_credit" : "admin_debit",
    memo: reason,
    createdBy: admin.id,
  });

  back(
    locale,
    formData,
    slug,
    `${amount.amount > 0 ? "Credited" : "Debited"} ${Math.abs(amount.amount)} ${WALLET_ASSET_LABEL[asset]} ${amount.amount > 0 ? "to" : "from"} the treasury — recorded against your account.`,
  );
}

/**
 * Reverse one treasury row — and, when it is one leg of a member's
 * contribution or a payout, the other leg with it (`reverseRows`).
 */
export async function reverseTreasuryTransaction(formData: FormData) {
  const locale = safeLocale(formData.get("locale"));
  const admin = await requireAdmin(locale, "edit");

  const slug = String(formData.get("teamSlug") ?? "");
  const txId = String(formData.get("txId") ?? "");
  if (!slug) redirect(adminPath(locale, "/teams?msg=No+team+specified."));
  if (!txId || !isWalletTxId(txId)) back(locale, formData, slug, "No transaction specified.");

  const reason = reasonOf(formData);
  if (!reason) back(locale, formData, slug, reasonRequired("reversal"));

  const outcome = await reverseRows({ txId, reason, adminId: admin.id });
  if (!outcome.ok) back(locale, formData, slug, outcome.error);
  if (!outcome.reversed)
    back(locale, formData, slug, "That transaction has already been reversed.");
  back(
    locale,
    formData,
    slug,
    outcome.legs === 2
      ? "Transfer reversed — both legs are offset, on this treasury and on the member's wallet, and everything stays in the history."
      : "Transaction reversed — both rows stay in the history and net to zero.",
  );
}
