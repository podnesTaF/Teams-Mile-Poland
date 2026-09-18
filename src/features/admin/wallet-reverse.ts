import { eq } from "drizzle-orm";

import { walletTransactions, type WalletOwner, type WalletTransactionRow } from "@/db/schema";
import { ownerOf, recordWalletTransaction } from "@/features/wallet/data";
import { transferKey, transferLegOf } from "@/features/wallet/transfers";
import { getDb } from "@/lib/db";

import { getWalletTransaction } from "./wallet-data";

/**
 * The reversal — the one correction an append-only ledger allows — as a plain,
 * session-free act shared by the runner panel and the treasury panel.
 *
 * A row is reversible exactly once and only while it is `completed`: a
 * `failed` or `pending` row counts toward no balance, so offsetting it would
 * *create* the error it looks like it fixes; and a reversal is not itself
 * reversible — undoing a correction is a fresh decision, entered as a manual
 * credit or debit with its own reason. The `reversal:<txId>` key is what makes
 * "exactly once" true under a double press.
 *
 * **A transfer is reversed as a whole.** A contribution or a payout is two
 * legs of one fact (ADR 0012); reversing one leg alone would refund the member
 * while the treasury still shows the money, or the other way round — minting
 * or destroying ACER system-wide. So when the row is a transfer leg, its
 * sibling is found by the shared key stem and both reversals land in one
 * transaction, each on its own leg's owner. The admin reverses the row they
 * are looking at; the ledger does the rest. Reversing a payout can leave the
 * member's wallet negative; that is accepted for a correction and said in the
 * ADR.
 */

export type ReverseOutcome =
  | {
      ok: true;
      /** False when this exact reversal was already in the ledger. */
      reversed: boolean;
      /** How many rows the correction touched — 2 for a transfer. */
      legs: 1 | 2;
      /** The owner of the row the admin pointed at — where to send them back. */
      owner: WalletOwner;
    }
  | { ok: false; error: string; owner: WalletOwner | null };

async function siblingLeg(original: WalletTransactionRow): Promise<WalletTransactionRow | null> {
  const leg = transferLegOf(original.idempotencyKey);
  if (!leg) return null;
  const [row] = await getDb()
    .select()
    .from(walletTransactions)
    .where(
      eq(
        walletTransactions.idempotencyKey,
        transferKey(leg.transferId, leg.leg === "out" ? "in" : "out"),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function reverseRows({
  txId,
  reason,
  adminId,
}: {
  txId: string;
  reason: string;
  adminId: string;
}): Promise<ReverseOutcome> {
  const original = await getWalletTransaction(txId);
  if (!original) return { ok: false, error: "That transaction no longer exists.", owner: null };
  const owner = ownerOf(original);

  if (original.kind === "reversal") {
    return {
      ok: false,
      owner,
      error:
        "A correction cannot itself be reversed. Enter a manual credit or debit instead, with its own reason.",
    };
  }
  if (original.status !== "completed") {
    return {
      ok: false,
      owner,
      error: `Only a completed transaction can be reversed — this one is ${original.status} and counts toward no balance.`,
    };
  }

  const sibling = await siblingLeg(original);
  const legs: WalletTransactionRow[] = sibling ? [original, sibling] : [original];

  let reversed = false;
  await getDb().transaction(async (tx) => {
    for (const leg of legs) {
      const row = await recordWalletTransaction(
        {
          ...ownerOf(leg),
          asset: leg.asset,
          amountMinor: -leg.amountMinor,
          kind: "reversal",
          memo: reason,
          createdBy: adminId,
          reversesId: leg.id,
          idempotencyKey: `reversal:${leg.id}`,
        },
        tx,
      );
      if (row && leg.id === original.id) reversed = true;
    }
  });

  return { ok: true, reversed, legs: legs.length === 2 ? 2 : 1, owner };
}
