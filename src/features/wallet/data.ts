import { and, desc, eq, sql } from "drizzle-orm";

import {
  WALLET_ASSETS,
  walletTransactions,
  type WalletAsset,
  type WalletTransactionRow,
  type WalletTxKind,
  type WalletTxStatus,
} from "@/db/schema";
import { getDb } from "@/lib/db";

/**
 * The wallet ledger's only writer, and its read path.
 *
 * Every insert in the codebase goes through {@link recordWalletTransaction};
 * nothing anywhere issues `UPDATE` or `DELETE` against `wallet_transactions`
 * (see the table's doc comment — append-only is a code invariant). Corrections
 * are `reversal` rows. Balances are derived here by `SUM`, so there is no total
 * to keep in sync and no writer that can race another one into a wrong number.
 */

/** How many history rows one page shows. Small enough to stay fast on a phone. */
export const WALLET_HISTORY_PAGE_SIZE = 20;

export type NewWalletTransaction = {
  userId: string;
  asset: WalletAsset;
  /** Signed integer minor units (+ in / − out). Use `acerToMinor` from `config.ts`. */
  amountMinor: number;
  kind: WalletTxKind;
  /** Defaults to `completed` — the only status that counts toward a balance. */
  status?: WalletTxStatus;
  reference?: string | null;
  memo?: string | null;
  /** The admin who entered the row; omit for system accruals. */
  createdBy?: string | null;
  /** Only on `kind: "reversal"` — the row being corrected. */
  reversesId?: string | null;
  /**
   * Natural key of the causing fact ("participation:<registrationId>",
   * "referral_checkin:<referredUserId>", "stripe:<sessionId>"). Omit for
   * deliberately repeatable manual entries.
   */
  idempotencyKey?: string | null;
};

/**
 * Append one row to the ledger.
 *
 * Returns the inserted row, or `null` when an `idempotencyKey` was given and
 * the causing fact is already recorded — a desk re-scan and a redelivered
 * Stripe webhook both land here, and the partial unique index turns the second
 * attempt into a no-op rather than a second credit. `null` is therefore a
 * success, not a failure: the money is already in the ledger.
 */
export async function recordWalletTransaction(
  input: NewWalletTransaction,
): Promise<WalletTransactionRow | null> {
  const rows = await getDb()
    .insert(walletTransactions)
    .values({
      userId: input.userId,
      asset: input.asset,
      amountMinor: input.amountMinor,
      kind: input.kind,
      status: input.status ?? "completed",
      reference: input.reference ?? null,
      memo: input.memo ?? null,
      createdBy: input.createdBy ?? null,
      reversesId: input.reversesId ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
    })
    // Targeted at the idempotency index (predicate included) rather than bare
    // `onConflictDoNothing()`: `null` from this function means "this exact fact
    // is already in the ledger", so any *other* constraint violation must throw
    // instead of being reported as a successful credit.
    .onConflictDoNothing({
      target: walletTransactions.idempotencyKey,
      where: sql`${walletTransactions.idempotencyKey} is not null`,
    })
    .returning();
  return rows[0] ?? null;
}

/** Balance per asset in minor units. Every asset is present, zero when unissued. */
export type WalletBalances = Record<WalletAsset, number>;

const ZERO_BALANCES: WalletBalances = { ACER: 0, ACE_PL: 0, ACEG: 0 };

/**
 * The user's balances, `SUM(amount_minor)` over `completed` rows per asset.
 *
 * Pending and failed rows are excluded on purpose: a purchase that Stripe has
 * not settled is visible in the history with its status but is not money yet.
 * Assets with no rows come back as 0 rather than missing, so the page renders
 * the ecosystem's full asset set without special-casing an empty wallet.
 */
export async function getWalletBalances(userId: string): Promise<WalletBalances> {
  const rows = await getDb()
    .select({
      asset: walletTransactions.asset,
      total: sql<number>`coalesce(sum(${walletTransactions.amountMinor}), 0)`.mapWith(Number),
    })
    .from(walletTransactions)
    .where(and(eq(walletTransactions.userId, userId), eq(walletTransactions.status, "completed")))
    .groupBy(walletTransactions.asset);

  const balances: WalletBalances = { ...ZERO_BALANCES };
  for (const row of rows) {
    // A row for an asset outside the known set (a future asset on a rolled-back
    // deploy) is ignored rather than crashing the page.
    if (WALLET_ASSETS.includes(row.asset)) balances[row.asset] = row.total;
  }
  return balances;
}

export type WalletHistoryPage = {
  rows: WalletTransactionRow[];
  /** 1-based. */
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
};

/**
 * A page of the user's transaction history, newest first — every row, whatever
 * its status, because "where is my ACER" is only answerable if a pending or
 * failed row is visible.
 *
 * `page` is clamped into range, so a bookmarked `?page=99` on a shrunken
 * history shows the last page instead of an empty one.
 */
export async function listWalletTransactions(
  userId: string,
  { page = 1, pageSize = WALLET_HISTORY_PAGE_SIZE }: { page?: number; pageSize?: number } = {},
): Promise<WalletHistoryPage> {
  const db = getDb();
  const [countRow] = await db
    .select({ total: sql<number>`count(*)`.mapWith(Number) })
    .from(walletTransactions)
    .where(eq(walletTransactions.userId, userId));

  const total = countRow?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, page), pageCount);

  const rows =
    total === 0
      ? []
      : await db
          .select()
          .from(walletTransactions)
          .where(eq(walletTransactions.userId, userId))
          .orderBy(desc(walletTransactions.createdAt), desc(walletTransactions.id))
          .limit(pageSize)
          .offset((current - 1) * pageSize);

  return { rows, page: current, pageCount, total, pageSize };
}

/**
 * `?page=` off a page's searchParams — 1-based, tolerant of the junk a
 * hand-edited or stale URL carries (`?page=0`, `?page=abc`, a repeated param).
 * Mirrors the roster's query parsing.
 */
export function parseWalletPage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}
