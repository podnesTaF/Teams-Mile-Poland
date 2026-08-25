import { desc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { users, walletTransactions, type WalletTransactionRow } from "@/db/schema";
import { walletPageWindow, type WalletHistoryPage } from "@/features/wallet/data";
import { getDb } from "@/lib/db";

/**
 * The admin panel's read path into the wallet ledger.
 *
 * Reads only — every insert still goes through `recordWalletTransaction` in
 * `src/features/wallet/data.ts` (the ledger's single writer), and nothing here
 * or anywhere else issues `UPDATE`/`DELETE` against the table. These live
 * beside the other `*-data.ts` admin readers rather than in the wallet feature
 * because they answer questions only the panel asks: *who* entered a manual row
 * and *whether* a row has already been corrected — neither of which the runner's
 * own history shows.
 */

/**
 * Rows per page in the panel. Larger than the cabinet's 20: this table is
 * scanned to answer "where did that ACER come from", on a desk-width screen.
 */
export const ADMIN_WALLET_PAGE_SIZE = 25;

/**
 * A typo guard, not a policy: the largest manual adjustment anyone has a reason
 * to enter by hand. A misplaced keystroke on an unbounded field mints five
 * figures of credit, and the correction (a reversal) is then permanently in the
 * ledger. Enforced by the action; the form carries it as `min`/`max` so the
 * field refuses what the server would refuse.
 */
export const MAX_ADJUSTMENT_ACER = 100_000;

/** Long enough for a real explanation, short enough to read in a table cell. */
export const MAX_REASON_LENGTH = 500;

export type AdminWalletEntry = WalletTransactionRow & {
  /** The admin who entered the row; null for system accruals. */
  authorName: string | null;
  authorEmail: string | null;
  /**
   * The `reversal` row that already corrects this one, if any. Present so the
   * panel can offer the reverse action once and then show the correction
   * instead — the ledger is append-only, so a row is reversed at most once.
   */
  reversedById: string | null;
};

/** The cabinet's history page, carrying the panel's richer rows. */
export type AdminWalletLedgerPage = Omit<WalletHistoryPage, "rows"> & {
  rows: AdminWalletEntry[];
};

/** A uuid the ledger could actually hold — Postgres errors on anything else. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isWalletTxId(value: string): boolean {
  return UUID.test(value);
}

/**
 * One page of a user's ledger, newest first, with the two things the panel adds
 * to the runner's own view: the author of each manual row and the correction
 * that already offsets it.
 *
 * Every row is returned whatever its status — a pending or failed purchase is
 * precisely what a "where is my ACER" ticket is about.
 */
export async function listWalletLedger(
  userId: string,
  { page = 1, pageSize = ADMIN_WALLET_PAGE_SIZE }: { page?: number; pageSize?: number } = {},
): Promise<AdminWalletLedgerPage> {
  const db = getDb();
  const [countRow] = await db
    .select({ total: sql<number>`count(*)`.mapWith(Number) })
    .from(walletTransactions)
    .where(eq(walletTransactions.userId, userId));

  const total = countRow?.total ?? 0;
  const { page: current, pageCount, offset } = walletPageWindow(total, page, pageSize);

  if (total === 0) return { rows: [], page: current, pageCount, total, pageSize };

  // Self-join for the correction: `reverses_id` points from the reversal at the
  // row it offsets, so "has this been reversed" is the reverse direction.
  const correction = alias(walletTransactions, "correction");
  const rows = await db
    .select({
      tx: walletTransactions,
      authorName: users.name,
      authorEmail: users.email,
      reversedById: correction.id,
    })
    .from(walletTransactions)
    .leftJoin(users, eq(users.id, walletTransactions.createdBy))
    .leftJoin(correction, eq(correction.reversesId, walletTransactions.id))
    .where(eq(walletTransactions.userId, userId))
    .orderBy(desc(walletTransactions.createdAt), desc(walletTransactions.id))
    .limit(pageSize)
    .offset(offset);

  return {
    rows: rows.map((r) => ({
      ...r.tx,
      authorName: r.authorName,
      authorEmail: r.authorEmail,
      reversedById: r.reversedById,
    })),
    page: current,
    pageCount,
    total,
    pageSize,
  };
}

/**
 * One ledger row by its TxID, or null. The caller must have checked the id with
 * {@link isWalletTxId} first — a hand-edited form value is not a uuid and
 * Postgres refuses to compare it rather than returning nothing.
 */
export async function getWalletTransaction(id: string): Promise<WalletTransactionRow | null> {
  const [row] = await getDb()
    .select()
    .from(walletTransactions)
    .where(eq(walletTransactions.id, id))
    .limit(1);
  return row ?? null;
}
