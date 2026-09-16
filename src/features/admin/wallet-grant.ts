import { acerToMinor } from "@/features/wallet/config";
import { recordWalletTransaction } from "@/features/wallet/data";
import { getDb } from "@/lib/db";

import {
  countUsersByIds,
  isUuid,
  MAX_ADJUSTMENT_ACER,
  MAX_BULK_RECIPIENTS,
  MAX_REASON_LENGTH,
} from "./wallet-data";

/**
 * One bulk ACER grant: its validation and the transaction that writes it.
 *
 * Deliberately **not** a `"use server"` module and deliberately session-free,
 * the same split `admin-grant.ts` makes for the admin role: the server action in
 * `wallet-actions.ts` is the authorization and the redirect, this is the act
 * itself, and a verification script can drive the act without forging a
 * session. Callers do their own authorization — nothing here checks who is
 * asking, and `adminId` is recorded, not trusted.
 *
 * **Credit only.** A bulk debit is a mistake magnet; debits stay on the
 * per-user panel where the admin is looking at one ledger. Every refusal
 * happens before the first insert, because a grant that credited half a list is
 * worse than one that credited none: the admin cannot tell which half.
 */

export type BulkGrantInput = {
  /** The accounts to credit. De-duplicated here; order is irrelevant. */
  userIds: string[];
  /** Whole positive ACER, the unit the admin types. */
  amountAcer: number;
  /** The mandatory audit reason, stored in every row's `memo`. */
  reason: string;
  /**
   * The uuid that ties the rows of one grant together, minted when the form was
   * rendered. It is both the `reference` handle that finds every row of a grant
   * in the ledger and, with the user id, the idempotency key that makes a double
   * submit a no-op.
   */
  batchId: string;
  /** The admin the rows are recorded against (`created_by`). */
  adminId: string;
};

export type BulkGrantOutcome =
  | { ok: false; error: string }
  | {
      ok: true;
      /** Rows actually appended; 0 means this batch was already recorded. */
      credited: number;
      /** How many accounts the grant named, after de-duplication. */
      recipients: number;
    };

/** The ids as the grant will use them: no blanks, no repeats, order preserved. */
function normalizeIds(userIds: string[]): string[] {
  return [...new Set(userIds.map((id) => id.trim()).filter(Boolean))];
}

/**
 * Credit `amountAcer` to every named account in one transaction, or credit
 * nobody.
 *
 * The idempotency key is `grant:<batchId>:<userId>`, so pressing the button
 * twice — or a browser retrying the post — lands on the partial unique index
 * and appends nothing the second time (`credited: 0`, reported as "already
 * credited"). A *fresh* page render mints a fresh `batchId`, so a deliberate
 * second grant to the same people still works. That is a refinement of the
 * per-user form's "deliberately repeatable, no key" stance rather than a
 * reversal of it: one considered entry is repeatable, one button press is not.
 */
export async function creditAcerBulk(input: BulkGrantInput): Promise<BulkGrantOutcome> {
  const ids = normalizeIds(input.userIds);
  if (ids.length === 0) {
    return { ok: false, error: "Tick at least one person before crediting." };
  }
  if (ids.length > MAX_BULK_RECIPIENTS) {
    return {
      ok: false,
      error: `One grant covers at most ${MAX_BULK_RECIPIENTS} people — this one named ${ids.length}. Credit them in smaller batches.`,
    };
  }

  const amount = input.amountAcer;
  if (!Number.isInteger(amount)) {
    return { ok: false, error: "Enter the amount as a whole number of ACER." };
  }
  if (amount <= 0) {
    return { ok: false, error: "A bulk grant only credits — enter a positive amount of ACER." };
  }
  if (amount > MAX_ADJUSTMENT_ACER) {
    return {
      ok: false,
      error: `That is larger than a manual adjustment can be (${MAX_ADJUSTMENT_ACER} ACER). Check the amount.`,
    };
  }

  const reason = input.reason.trim();
  if (!reason || reason.length > MAX_REASON_LENGTH) {
    return {
      ok: false,
      error: `Give a reason for the grant (up to ${MAX_REASON_LENGTH} characters) — it is what makes it auditable.`,
    };
  }

  if (!isUuid(input.batchId)) {
    return {
      ok: false,
      error: "This form is stale — reload the users list and make the selection again.",
    };
  }

  if (!input.adminId) {
    return { ok: false, error: "No acting admin — the grant was not recorded." };
  }

  const amountMinor = acerToMinor(amount);

  return getDb().transaction(async (tx) => {
    // Inside the transaction, so a list assembled from a stale page is refused
    // against the same snapshot the inserts would use rather than against a
    // reading taken a moment earlier.
    const found = await countUsersByIds(ids, tx);
    if (found !== ids.length) {
      const missing = ids.length - found;
      return {
        ok: false as const,
        error: `${missing} of the ${ids.length} selected ${ids.length === 1 ? "account" : "accounts"} no longer ${missing === 1 ? "exists" : "exist"} — nobody was credited. Reload the list and select again.`,
      };
    }

    let credited = 0;
    for (const userId of ids) {
      const row = await recordWalletTransaction(
        {
          userId,
          asset: "ACER",
          amountMinor,
          kind: "admin_credit",
          memo: reason,
          createdBy: input.adminId,
          reference: `grant:${input.batchId}`,
          idempotencyKey: `grant:${input.batchId}:${userId}`,
        },
        tx,
      );
      if (row) credited += 1;
    }

    return { ok: true as const, credited, recipients: ids.length };
  });
}
