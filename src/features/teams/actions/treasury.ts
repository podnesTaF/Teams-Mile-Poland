"use server";

import { revalidatePath } from "next/cache";

import { acerToMinor, isValidTreasuryAmount } from "@/features/wallet/config";
import { getAcerBalance, getTeamAcerBalance } from "@/features/wallet/data";
import {
  isInsufficientAcer,
  isStaleTransfer,
  isWalletOwnerNotFound,
  transferAssertionCode,
} from "@/features/wallet/errors";
import { isTreasuryPayoutEnabled } from "@/features/wallet/transfers";

import { teamFailure, type TeamActionReason, type TeamActionResult } from "../config";
import { requireTeamManagerOrAdmin, requireTeamMember } from "../guards";
import {
  treasuryContributionSchema,
  treasuryPayoutSchema,
  type TreasuryContributionInput,
  type TreasuryPayoutInput,
} from "../schemas";
import { contributeRows, payoutRows } from "../treasury";

/**
 * The team treasury's two user-facing actions (ADR 0012): a member contributes,
 * the manager pays out. Both return the frozen `{ ok: true, … } | { ok: false,
 * reason, message }` shape and never throw for an expected refusal.
 *
 * Gate → zod → courtesy pre-check → `../treasury` → result. The pre-check
 * outside the transaction makes the everyday shortfall a sentence rather than a
 * rollback; the in-transaction re-read under the payer's lock is what makes it
 * true when two presses race, and it comes back as the same refusal.
 */

export type TreasuryMoveResult = TeamActionResult<{
  /** True when this exact press was already recorded — nothing moved twice. */
  alreadyRecorded: boolean;
  /** The treasury after the move, in minor units. */
  treasuryMinor: number;
  /** The actor's own wallet after the move, in minor units. */
  balanceMinor: number;
}>;

/** What `../treasury` threw, as the refusal the UI shows. `null` = not ours, rethrow. */
function refusalOf(error: unknown, payer: "user" | "team"): TeamActionReason | null {
  if (isInsufficientAcer(error)) {
    return payer === "user" ? "insufficient_balance" : "treasury_insufficient";
  }
  if (isStaleTransfer(error)) return "stale_form";
  if (isWalletOwnerNotFound(error)) return "notfound";
  const code = transferAssertionCode(error);
  if (code === "not_a_member") return "not_a_member";
  return null;
}

function revalidateTreasurySurfaces(): void {
  revalidatePath("/[locale]/teams/[slug]", "page");
  revalidatePath("/[locale]/teams/[slug]/treasury", "page");
  revalidatePath("/[locale]/wallet", "page");
  revalidatePath("/[locale]/profile", "page");
}

/**
 * Pay whole ACER from the actor's own wallet into their team's treasury. Any
 * roster member may — the manager included, who holds a seat like everyone
 * else. An admin who is not on the roster is refused `forbidden`; the grant
 * form on the admin team page is their path.
 */
export async function contributeToTreasury(
  slug: string,
  input: TreasuryContributionInput,
): Promise<TreasuryMoveResult> {
  const member = await requireTeamMember(slug);
  if (!member.ok) return member;

  const parsed = treasuryContributionSchema.safeParse(input);
  if (!parsed.success) return teamFailure("invalid");
  if (!isValidTreasuryAmount(parsed.data.amountAcer)) return teamFailure("invalid_amount");
  const amountMinor = acerToMinor(parsed.data.amountAcer);

  if ((await getAcerBalance(member.userId)) < amountMinor) {
    return teamFailure("insufficient_balance");
  }

  let alreadyRecorded: boolean;
  try {
    ({ alreadyRecorded } = await contributeRows({
      team: member.team,
      amountMinor,
      actorUserId: member.userId,
      transferId: parsed.data.transferId,
    }));
  } catch (error) {
    const reason = refusalOf(error, "user");
    if (reason) return teamFailure(reason);
    throw error;
  }

  revalidateTreasurySurfaces();
  const [treasuryMinor, balanceMinor] = await Promise.all([
    getTeamAcerBalance(member.team.id),
    getAcerBalance(member.userId),
  ]);
  return { ok: true, alreadyRecorded, treasuryMinor, balanceMinor };
}

/**
 * Pay whole ACER out of the treasury to a current roster member. The manager's
 * call (or an admin with `edit` acting for them). Off — `payouts_disabled` —
 * until `TREASURY_PAYOUTS_ENABLED=1`, because the Terms of Use still forbid
 * moving ACER to another person; see `isTreasuryPayoutEnabled`.
 */
export async function payoutFromTreasury(
  slug: string,
  input: TreasuryPayoutInput,
): Promise<TreasuryMoveResult> {
  if (!isTreasuryPayoutEnabled()) return teamFailure("payouts_disabled");

  const manager = await requireTeamManagerOrAdmin(slug);
  if (!manager.ok) return manager;

  const parsed = treasuryPayoutSchema.safeParse(input);
  if (!parsed.success) return teamFailure("invalid");
  if (!isValidTreasuryAmount(parsed.data.amountAcer)) return teamFailure("invalid_amount");
  const amountMinor = acerToMinor(parsed.data.amountAcer);

  if ((await getTeamAcerBalance(manager.team.id)) < amountMinor) {
    return teamFailure("treasury_insufficient");
  }

  let alreadyRecorded: boolean;
  try {
    ({ alreadyRecorded } = await payoutRows({
      team: manager.team,
      memberUserId: parsed.data.memberUserId,
      amountMinor,
      actorUserId: manager.userId,
      transferId: parsed.data.transferId,
    }));
  } catch (error) {
    const reason = refusalOf(error, "team");
    if (reason) return teamFailure(reason);
    throw error;
  }

  revalidateTreasurySurfaces();
  const [treasuryMinor, balanceMinor] = await Promise.all([
    getTeamAcerBalance(manager.team.id),
    getAcerBalance(manager.userId),
  ]);
  return { ok: true, alreadyRecorded, treasuryMinor, balanceMinor };
}
