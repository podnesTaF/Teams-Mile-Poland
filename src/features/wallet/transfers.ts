import { eq } from "drizzle-orm";

import { users } from "@/db/schema/auth";
import { userTeams } from "@/db/schema/user-teams";
import type { WalletOwner, WalletTxKind } from "@/db/schema/wallet";
import { getDb, type Transaction } from "@/lib/db";

import { getAcerBalance, getWalletTransactionByKey, recordWalletTransaction } from "./data";
import { InsufficientAcerError, StaleTransferError, WalletOwnerNotFoundError } from "./errors";

/**
 * Moving ACER between two owners — a runner's wallet and a team's treasury
 * (ADR 0012). The first ledger operation that writes **two rows for one fact**:
 * the payer's leg (negative) and the payee's leg (positive), same `kind`, same
 * transaction, or neither.
 *
 * Plain module, no session: the server actions in
 * `src/features/teams/actions/treasury.ts` gate and translate, the thin
 * wrappers in `src/features/teams/treasury.ts` choose owners and kinds, and a
 * verification script can drive this directly against the real data layer.
 *
 * **Locks, and why these modes.** There is no stored balance to `UPDATE …
 * WHERE balance >= x`, so two spends by one payer must be serialised by a row
 * lock, the idiom `createTeamRows` set. The payer's row is taken `FOR NO KEY
 * UPDATE` rather than `FOR UPDATE`: it still excludes another spend by the same
 * payer (and `createTeamRows`' own `FOR UPDATE`), but it does **not** conflict
 * with the `KEY SHARE` a foreign key takes when a credit lands on that payer —
 * so a Stripe webhook or a desk accrual never queues behind a spend. The payee's
 * row is taken `FOR KEY SHARE`: enough to prove it exists at commit time and to
 * hold off a concurrent delete (a dissolve, an account removal) until this
 * movement is in the ledger, and compatible with the payee's own spend lock.
 * A contribution (payer: user) and a payout (payer: team) on the same team
 * therefore never wait on each other, and there is no cycle to deadlock on.
 * Rule for any future operation that needs two *strong* locks: acquire `users`
 * before `user_teams`.
 *
 * **Replay before balance.** The form mints a `transferId` per render, so a
 * double submit arrives with the same id. The `:out` leg is looked up under the
 * payer's lock *before* any balance read: the second submit would otherwise
 * re-read a balance that already includes the first debit and come back as
 * "insufficient" instead of "already recorded". Same id with different terms is
 * a stale form and is refused rather than silently swallowed.
 */

/** Idempotency-key stem shared by a transfer's two legs. */
export function transferKey(transferId: string, leg: "out" | "in"): string {
  return `transfer:${transferId}:${leg}`;
}

/** The two legs of transfer `transferId`, if `key` is one of them. */
export function transferLegOf(
  key: string | null,
): { transferId: string; leg: "out" | "in" } | null {
  const match = key?.match(/^transfer:([0-9a-f-]{36}):(out|in)$/);
  return match ? { transferId: match[1], leg: match[2] as "out" | "in" } : null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A client-minted `crypto.randomUUID()`, and nothing else, may key a transfer. */
export function isTransferId(value: string): boolean {
  return UUID_RE.test(value);
}

export type TransferAcerInput = {
  from: WalletOwner;
  to: WalletOwner;
  /** Positive integer minor units; the payer's leg carries the minus. */
  amountMinor: number;
  kind: WalletTxKind;
  /** The person pressing the button — `created_by` on both legs. */
  actorUserId: string;
  /** Client-minted uuid; the idempotency stem of both legs. */
  transferId: string;
  /** What each leg's history line points at — the counterparty, usually. */
  reference: { out: string | null; in: string | null };
  memo?: string | null;
  /**
   * The caller's own precondition, run after the locks and before the writes —
   * a payout's "the payee is still on the roster" check, taken under a lock of
   * its own so a concurrent removal waits. Throws to refuse.
   */
  assert?: (tx: Transaction) => Promise<void>;
};

export type TransferAcerOutcome = {
  /** True when this exact transfer was already in the ledger; nothing was written. */
  alreadyRecorded: boolean;
};

function ownerTable(owner: WalletOwner) {
  return owner.userId
    ? { table: users, id: users.id, value: owner.userId }
    : { table: userTeams, id: userTeams.id, value: owner.teamId as string };
}

export async function transferAcer(input: TransferAcerInput): Promise<TransferAcerOutcome> {
  const { from, to, amountMinor, kind, actorUserId, transferId, reference, memo } = input;
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
    throw new Error(`transferAcer: amountMinor must be a positive integer, got ${amountMinor}`);
  }
  if (!isTransferId(transferId)) {
    throw new Error("transferAcer: transferId must be a uuid");
  }

  const payer = ownerTable(from);
  const payee = ownerTable(to);
  let alreadyRecorded = false;

  await getDb().transaction(async (tx) => {
    // 1. The payer's mutex. The row is selected only to take the lock.
    const [payerRow] = await tx
      .select({ id: payer.id })
      .from(payer.table)
      .where(eq(payer.id, payer.value))
      .for("no key update");
    if (!payerRow) throw new WalletOwnerNotFoundError("from");

    // 2. The payee exists, and keeps existing until we commit.
    const [payeeRow] = await tx
      .select({ id: payee.id })
      .from(payee.table)
      .where(eq(payee.id, payee.value))
      .for("key share");
    if (!payeeRow) throw new WalletOwnerNotFoundError("to");

    // 3. A replayed form, told apart from a new one before any balance read.
    const existing = await getWalletTransactionByKey(from, transferKey(transferId, "out"), tx);
    if (existing) {
      if (existing.amountMinor !== -amountMinor || existing.kind !== kind) {
        throw new StaleTransferError(transferId);
      }
      alreadyRecorded = true;
      return;
    }

    // 4. The caller's own precondition, under the same transaction.
    await input.assert?.(tx);

    // 5. The balance, read under the payer's lock.
    const balanceMinor = await getAcerBalance(from, tx);
    if (balanceMinor < amountMinor) throw new InsufficientAcerError(amountMinor, balanceMinor);

    // 6. Two legs, one fact.
    await recordWalletTransaction(
      {
        ...from,
        asset: "ACER",
        amountMinor: -amountMinor,
        kind,
        reference: reference.out,
        memo: memo ?? null,
        createdBy: actorUserId,
        idempotencyKey: transferKey(transferId, "out"),
      },
      tx,
    );
    await recordWalletTransaction(
      {
        ...to,
        asset: "ACER",
        amountMinor,
        kind,
        reference: reference.in,
        memo: memo ?? null,
        createdBy: actorUserId,
        idempotencyKey: transferKey(transferId, "in"),
      },
      tx,
    );
  });

  return { alreadyRecorded };
}

/**
 * Whether the manager may pay ACER out of a treasury to a member.
 *
 * The Terms of Use still say ACER "cannot be moved to another user"; a payout
 * does exactly that, so the affordance stays off until the wording is revised
 * with counsel — `TREASURY_PAYOUTS_ENABLED=1` is the deliberate config change on
 * that day (the same shape as `isAcerPurchaseEnabled`). Contributions and admin
 * grants are not gated: they move money into a team, not to another person.
 *
 * Deliberately not `NEXT_PUBLIC_`: the server decides whether money moves.
 */
export function isTreasuryPayoutEnabled(): boolean {
  return process.env.TREASURY_PAYOUTS_ENABLED === "1";
}
