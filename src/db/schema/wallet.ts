import { sql } from "drizzle-orm";
import {
  bigint,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

import { users } from "./auth";

/**
 * The three cabinet assets (ТЗ 2.6.1). `ACE_PL` is the ТЗ's ACE[cc] localised
 * token; only `ACER` is issued in v1 — the other two are displayed read-only at
 * zero because no rule creates them yet.
 */
export type WalletAsset = "ACER" | "ACE_PL" | "ACEG";

export const WALLET_ASSETS: readonly WalletAsset[] = ["ACER", "ACE_PL", "ACEG"];

/**
 * Why a row exists — the ТЗ 2.6.3 income sources plus purchase and admin
 * correction. The full vocabulary is declared up front (and labelled in all
 * three catalogs) so later slices only insert rows: `prize_reward` and
 * `referral_ticket` are reserved and unwritten in v1, and the `kind` column is
 * also what keeps earned ACER distinguishable from purchased ACER for free.
 */
export type WalletTxKind =
  | "participation_reward" // 2.6.3.2 — the runner's own check-in
  | "prize_reward" // 2.6.3.2 podium prizes (reserved; nothing writes it in v1)
  | "referral_signup" // 2.6.3.1 — referred person's first-ever check-in
  | "referral_ticket" // 2.6.3.1 ticket-sales income (0 while entry is free)
  | "referral_sponsor" // 2.6.3.1 sponsor attraction (admin-entered)
  | "purchase" // 2.6.2.1 card top-up. Never withdrawable
  | "admin_credit"
  | "admin_debit"
  | "reversal"; // the correction of an earlier row

/** ТЗ 2.6.4.2 status vocabulary. Only `completed` rows count toward a balance. */
export type WalletTxStatus = "completed" | "pending" | "failed";

/**
 * The wallet ledger: one signed row per movement of one asset for one user.
 *
 * **Append-only, and that is a code invariant, not a database one.** Every
 * insert goes through `recordWalletTransaction` in
 * `src/features/wallet/data.ts`, and nothing in this codebase issues `UPDATE`
 * or `DELETE` against this table — a mistake is corrected by a new `reversal`
 * row pointing at the original through `reversesId`, so the error stays
 * visible instead of being erased. Anything that edits a row in place breaks
 * the audit trail that makes a balance reproducible from its causes.
 *
 * **There is no balance column.** A balance is
 * `SUM(amount_minor) WHERE status = 'completed'` per `(user, asset)` — two
 * writers racing on `balance = balance + x` (a desk check-in accrual and a
 * Stripe webhook retry) lose money silently, and a stored total tells you
 * nothing about how it got there. `(user_id, asset)` is indexed for it; if the
 * read ever stops being trivial the fix is a cached projection behind the same
 * read function, not a schema change.
 *
 * **Idempotency is by natural key.** `idempotency_key` carries the fact that
 * caused the row ("participation:<registrationId>",
 * "referral_checkin:<referredUserId>", "stripe:<sessionId>"), and the partial
 * unique index below is what makes a desk re-scan and Stripe's at-least-once
 * delivery credit exactly once — by construction, not by a guard someone has
 * to remember. Manual admin entries carry null: they are deliberately
 * repeatable.
 *
 * Money is counted in integer minor units (1 ACER = 100 minor = 1 USD) — the
 * same no-floats-in-money rule as `event_results.time_cs` and the legacy
 * groszy price, in a wider column because a ledger accumulates forever. `asset` / `kind` /
 * `status` are `text` + `$type<>` rather than pgEnum: `ALTER TYPE … ADD VALUE`
 * cannot run inside a transaction and stranded migration 0012 on the live DB
 * (see `event-results.ts` and `auth.ts`), and these are value sets that will
 * grow.
 */
export const walletTransactions = pgTable(
  "wallet_transactions",
  {
    /** The TxID shown to the user in their history (ТЗ 2.6.4.2). */
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    asset: text("asset").$type<WalletAsset>().notNull(),
    /** Signed integer minor units (+ in / − out). 1 ACER = 100 minor = 1 USD. */
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
    kind: text("kind").$type<WalletTxKind>().notNull(),
    status: text("status").$type<WalletTxStatus>().default("completed").notNull(),
    /**
     * What caused the row, for the history line and later drill-down:
     * `event:<slug>` | `registration:<uuid>` | `stripe:<sessionId>` | `user:<id>`.
     * Event references travel as slug text — events are config, not a table.
     */
    reference: text("reference"),
    /** Free-text purpose (ТЗ 2.6.4.2 «Назначение платежа») and the mandatory admin reason. */
    memo: text("memo"),
    /**
     * The admin who entered the row; null for system accruals. Audit trail.
     *
     * `set null` rather than `cascade`: deleting an admin account must never
     * delete ledger rows, and it must not be blocked by them either. The
     * mandatory `memo` survives, so a manual entry stays explainable even
     * after its author's account is gone.
     */
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    /** The row this one reverses. Set only on `kind = "reversal"`. */
    reversesId: uuid("reverses_id").references((): AnyPgColumn => walletTransactions.id),
    /** Natural key of the causing fact; null for repeatable manual entries. */
    idempotencyKey: text("idempotency_key"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("wallet_tx_idempotency_uq")
      .on(table.idempotencyKey)
      .where(sql`${table.idempotencyKey} is not null`),
    index("wallet_tx_user_asset_idx").on(table.userId, table.asset),
    index("wallet_tx_user_created_idx").on(table.userId, table.createdAt),
  ],
);

export type WalletTransactionRow = typeof walletTransactions.$inferSelect;
