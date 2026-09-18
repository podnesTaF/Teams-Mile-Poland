import { and, eq, inArray } from "drizzle-orm";

import {
  walletTransactions,
  type WalletOwner,
  type WalletTransactionRow,
} from "@/db/schema/wallet";
import { getDb, type DbExecutor } from "@/lib/db";

import { getWalletTransactionByKey, ownerOf, recordWalletTransaction } from "./data";

/**
 * Giving an entry fee back — the other half of `entry-fees.ts` (ADR 0013,
 * slice 5 of `planning/event-entry-fees`).
 *
 * Two facts give a fee back, and only two: a team **withdrawing while the night
 * is still `registration_open`**, and an **event being cancelled**. The rule is
 * the owner's and it is about what the organiser can still sell — a withdrawal
 * releases a place somebody else can still take while entries are open, and
 * cannot once they are closed, so after that the fee is forfeited. Cancelling
 * refunds everything the night took, team and individual, because nobody bought
 * anything. Removing one member from an entry refunds nothing: the fee is per
 * team per night, not per head, which is also why adding one costs nothing.
 *
 * Neither caller decides any of that here. {@link refundEntryFee} is the
 * primitive — "give this fee row back, once" — and the decision of *whether*
 * lives where the event is known: `withdrawEntry` for a withdrawal, and
 * {@link refundEventFees} for a cancellation, which by definition refunds all
 * of them.
 *
 * **Nothing in this module updates or deletes a ledger row.** A refund is a new
 * row of its own kind, `entry_fee_refund`, pointing back at the debit through
 * `reverses_id` — not a `reversal`, which reads to the person whose money moved
 * as "an admin fixed a mistake", and the debit was right when it was made (ADR
 * 0013 decision 7). The ledger is append-only and a refund is a second event,
 * not an edit to the first.
 *
 * **Idempotency is the whole design.** Both callers can legitimately run twice
 * — a double-clicked Withdraw, an event cancelled, un-cancelled and cancelled
 * again — so every refund is keyed on the fact that caused it
 * ({@link entryFeeRefundKey}), and `recordWalletTransaction` turns the second
 * attempt into a `null` that this module reports as `already_refunded`. A
 * missing fee row is a **success** too: a free night and an entry made before
 * fees existed both have nothing to give back, and neither is an error.
 */

/* ------------------------------------------------------------------ keys */

/**
 * The two spellings a fee row is keyed under, named here because the refund is
 * the only code that has to **find** a fee row rather than write one.
 *
 * `team_entry_fee:` is written by `teamEntryFeeKey` in
 * `features/teams/entries.ts` and must be looked up through that function, not
 * through this constant — this one exists for {@link entryFeeCauseId}, which
 * reads a key off a row it found in the ledger and has no entry id to hand.
 * `entry_fee:` is written inline by `createRegistrationWithConsent`; this
 * module is where the refund side names it, and
 * {@link individualEntryFeeKey} is the spelling a caller should use.
 * `scripts/verify-entry-fee-refunds.ts` proves both agree with the rows the two
 * writers actually produce — a fee written under one spelling and looked up
 * under another would silently refund nothing, which is the one failure this
 * feature must not have.
 */
const TEAM_FEE_PREFIX = "team_entry_fee:";
const INDIVIDUAL_FEE_PREFIX = "entry_fee:";

/** The key an individual registration's fee row carries. */
export function individualEntryFeeKey(registrationId: string): string {
  return `${INDIVIDUAL_FEE_PREFIX}${registrationId}`;
}

/**
 * The key a refund carries: `entry_fee_refund:<causeId>`, where the cause is
 * the **same id that keyed the fee** — the entry for a team fee, the
 * registration for an individual one.
 *
 * Keyed on the cause rather than on the fee row's own id so that a caller
 * holding only an entry id can write the refund and check for it without
 * reading the ledger first, and so the two rows read as one story to anyone
 * scanning the history: `team_entry_fee:<id>` out, `entry_fee_refund:<id>`
 * back. There is exactly one fee per cause, so one refund per cause is the
 * right cardinality.
 */
export function entryFeeRefundKey(causeId: string): string {
  return `entry_fee_refund:${causeId}`;
}

/**
 * The id a fee row was keyed on, or `null` if the key is not a fee key.
 *
 * Only the sweep needs this: it finds fee rows by querying the ledger, so the
 * key is what it has and the entry or registration id is what it needs to build
 * the refund key from. Strict on purpose — an unrecognised key is reported and
 * skipped rather than refunded under a guessed key, because a refund written
 * under the wrong key is a refund that can be written twice.
 */
export function entryFeeCauseId(feeKey: string | null | undefined): string | null {
  if (!feeKey) return null;
  if (feeKey.startsWith(TEAM_FEE_PREFIX)) return feeKey.slice(TEAM_FEE_PREFIX.length) || null;
  if (feeKey.startsWith(INDIVIDUAL_FEE_PREFIX)) {
    return feeKey.slice(INDIVIDUAL_FEE_PREFIX.length) || null;
  }
  return null;
}

/* ------------------------------------------------------------- primitive */

/**
 * What one call to {@link refundEntryFee} did.
 *
 * Three outcomes and only one of them writes anything; all three are successes.
 * `no_fee` is the free night and the pre-fees entry, `already_refunded` is the
 * second press of Withdraw and the second cancellation.
 */
export type EntryFeeRefundOutcome = "refunded" | "already_refunded" | "no_fee";

export type EntryFeeRefundResult = {
  outcome: EntryFeeRefundOutcome;
  /**
   * Minor units **this call** credited — `0` for both no-op outcomes, so a
   * caller can sum it across a sweep and get what the sweep actually moved
   * rather than what was once taken.
   */
  amountMinor: number;
  /** The debit that was found, for a caller that wants to report on it. */
  fee: WalletTransactionRow | null;
};

/**
 * Give one entry fee back: find the debit by its key, and append one
 * `entry_fee_refund` row for the same amount with the sign flipped.
 *
 * Composes into a caller's transaction through `tx`, which is the point for a
 * withdrawal: the entry's deletion and the credit are one fact, and a runner
 * must never be able to observe an entry that is gone with the money still
 * taken, or money back with the place still held.
 *
 * The amount and the asset come **off the fee row**, never off the event: the
 * fee charged is the fee at the moment of entry (ADR 0013 decision 3), so a
 * night re-priced between the entry and the withdrawal gives back exactly what
 * it took and not a penny of the new price. That is also why there is no
 * `amountMinor` parameter — there is nothing for a caller to get wrong.
 *
 * Only a `completed` **debit** is refundable. A credit under a fee key would be
 * a refund found by the wrong key and refunding it would double the money; a
 * `pending` or `failed` row is money that was never taken, and crediting it
 * back would invent some.
 */
export async function refundEntryFee({
  owner,
  feeKey,
  refundKey,
  reference,
  createdBy,
  tx,
}: {
  owner: WalletOwner;
  /** The fee row's idempotency key — `teamEntryFeeKey(entryId)` or {@link individualEntryFeeKey}. */
  feeKey: string;
  /** This refund's own key, from {@link entryFeeRefundKey}. */
  refundKey: string;
  /**
   * `event:<slug>`, the stamp every wallet row about a race night carries.
   * Omitted, the fee row's own reference is copied, so the credit and the debit
   * land on the same night's story whatever the caller knows.
   */
  reference?: string | null;
  /** The admin or manager who caused the refund; omit for a system sweep. */
  createdBy?: string | null;
  tx?: DbExecutor;
}): Promise<EntryFeeRefundResult> {
  const fee = await getWalletTransactionByKey(owner, feeKey, tx);
  if (!fee || fee.amountMinor >= 0 || fee.status !== "completed") {
    return { outcome: "no_fee", amountMinor: 0, fee: null };
  }

  const amountMinor = -fee.amountMinor;
  const row = await recordWalletTransaction(
    {
      ...owner,
      asset: fee.asset,
      amountMinor,
      kind: "entry_fee_refund",
      reference: reference ?? fee.reference,
      createdBy: createdBy ?? null,
      // The audit chain: this row undoes that one. `reverses_id` was reserved
      // for `kind = 'reversal'` and widens here to "the row this one undoes"
      // (ADR 0013 decision 7) — the kind is a label on the money screen, the
      // link is the accounting.
      reversesId: fee.id,
      idempotencyKey: refundKey,
    },
    tx,
  );

  // `null` from the writer means the key is already in the ledger — the money
  // is already back, which is a success and not a second credit.
  return row
    ? { outcome: "refunded", amountMinor, fee }
    : { outcome: "already_refunded", amountMinor: 0, fee };
}

/* ----------------------------------------------------------------- sweep */

/** What one run of {@link refundEventFees} moved, for the log line and the caller. */
export type EventFeeSweep = {
  eventSlug: string;
  /** Fee rows found on the night, whatever this run did about them. */
  found: number;
  /** Refunds written **by this run**. A re-run of a done sweep reports 0. */
  refunded: number;
  /** Minor units credited by this run. */
  refundedMinor: number;
  /** Fee rows that were already given back — a withdrawal, or an earlier sweep. */
  alreadyRefunded: number;
  /** Fee rows this run could not key a refund from, or that threw. */
  skipped: number;
  failed: number;
};

/**
 * Refund every fee a night took, because the night is not happening.
 *
 * Called from the admin transition to `cancelled`. The owner's rule has no
 * exceptions here — team entries and individual registrations alike, whatever
 * the lifecycle status was when the money moved — so this does not ask about
 * withdrawal windows and does not need to.
 *
 * **Driven off the ledger, not off the entry and registration rows.** The
 * question "what did this night take" is a ledger question: one indexed query
 * on `reference = 'event:<slug>'` finds every fee row the night ever produced,
 * and the alternative — list the entries, list the registrations, then probe the
 * ledger once per row — is two queries per participant on a surface an admin
 * presses once, and still answers a *different* question. It answers a worse
 * one, too: a team that entered, forfeited its fee by withdrawing after
 * registration closed, and then finds the night cancelled has no entry row left,
 * and money it paid for a race nobody ran would never come back. The ledger
 * remembers what the entry tables no longer do.
 *
 * **One unit of work per refund, not one transaction for the sweep.** A single
 * transaction over an unbounded number of owners would turn any one failure
 * into "refunded nobody, and you cannot see how far it got" — and it buys
 * nothing, because no invariant couples two owners' refunds: each is complete on
 * its own. What makes partial progress safe is that every refund is keyed on its
 * cause, so a re-run writes only what is missing. At-least-once delivery with
 * exactly-once effect is the right shape here, and it is why the admin can
 * simply press Cancel again.
 *
 * **It never throws.** A refund that failed must not be the reason an event
 * cannot be cancelled: the night is off either way, and the organiser's ability
 * to say so must not depend on the ledger being reachable. Failures are counted,
 * logged with the fee row's id, and left for a re-run to pick up.
 */
export async function refundEventFees(
  eventSlug: string,
  options: { createdBy?: string | null } = {},
): Promise<EventFeeSweep> {
  const sweep: EventFeeSweep = {
    eventSlug,
    found: 0,
    refunded: 0,
    refundedMinor: 0,
    alreadyRefunded: 0,
    skipped: 0,
    failed: 0,
  };

  let fees: WalletTransactionRow[];
  try {
    fees = await getDb()
      .select()
      .from(walletTransactions)
      .where(
        and(
          eq(walletTransactions.reference, `event:${eventSlug}`),
          inArray(walletTransactions.kind, ["team_entry_fee", "individual_entry_fee"]),
          eq(walletTransactions.status, "completed"),
        ),
      );
  } catch (error) {
    console.error(`[wallet] cancellation sweep could not read fees for ${eventSlug}:`, error);
    return { ...sweep, failed: 1 };
  }

  sweep.found = fees.length;

  for (const fee of fees) {
    const causeId = entryFeeCauseId(fee.idempotencyKey);
    if (!causeId) {
      // A fee row with no key, or a key nobody recognises, cannot be refunded
      // *once*; refunding it under a guessed key would refund it again on the
      // next run. Reported so it can be handled by hand rather than silently
      // dropped.
      sweep.skipped += 1;
      console.warn(
        `[wallet] cancellation sweep skipped fee row ${fee.id} on ${eventSlug}: unkeyed (${fee.idempotencyKey ?? "null"})`,
      );
      continue;
    }

    try {
      const result = await refundEntryFee({
        owner: ownerOf(fee),
        feeKey: fee.idempotencyKey as string,
        refundKey: entryFeeRefundKey(causeId),
        reference: fee.reference,
        createdBy: options.createdBy ?? null,
      });
      if (result.outcome === "refunded") {
        sweep.refunded += 1;
        sweep.refundedMinor += result.amountMinor;
      } else if (result.outcome === "already_refunded") {
        sweep.alreadyRefunded += 1;
      } else {
        // Unreachable in practice — the row was read out of the ledger a moment
        // ago — but a concurrent nothing is still a nothing, not a failure.
        sweep.skipped += 1;
      }
    } catch (error) {
      sweep.failed += 1;
      console.error(`[wallet] refund failed for fee row ${fee.id} on ${eventSlug}:`, error);
    }
  }

  return sweep;
}
