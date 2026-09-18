import { sql } from "drizzle-orm";
import {
  bigint,
  check,
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
  | "team_creation" // spend: founding a team (planning/team-creation-payment). Always negative
  | "treasury_contribution" // a member pays into their team's treasury: user leg −, team leg + (ADR 0012)
  | "treasury_payout" // the manager pays a member out of the treasury: team leg −, user leg +
  | "team_entry_fee" // spend from the treasury: entering an event (reserved; nothing writes it yet)
  | "admin_credit"
  | "admin_debit"
  | "reversal"; // the correction of an earlier row

/** ТЗ 2.6.4.2 status vocabulary. Only `completed` rows count toward a balance. */
export type WalletTxStatus = "completed" | "pending" | "failed";

/**
 * Who a ledger row belongs to: a runner's wallet or a team's treasury (ADR
 * 0012). Exactly one of the two — the `wallet_tx_one_owner` check below is the
 * database's word for it, and this type is the compiler's. Every existing
 * `{ userId }` caller still fits; a treasury caller passes `{ teamId }`.
 */
export type WalletOwner =
  | { userId: string; teamId?: null | undefined }
  | { teamId: string; userId?: null | undefined };

/**
 * The wallet ledger: one signed row per movement of one asset for one owner —
 * a runner's wallet (`user_id`) or a team's treasury (`team_id`, ADR 0012).
 *
 * **Exactly one owner per row**, enforced by `wallet_tx_one_owner`. `team_id`
 * carries **no foreign key** on purpose: dissolving a team is a hard delete of
 * `user_teams`, and a cascade would delete money, `set null` would strip the
 * row of both owners and so make the delete itself fail the check, and
 * `restrict` would contradict the decision that a treasury is forfeited on
 * dissolve. Rows of a dissolved team stay, summable and reversible, under an
 * id no team holds any more — the same "reference outlives the referent" shape
 * as `team_entries.event_slug`. That a team exists when money moves into it is
 * asserted at write time under a `for key share` lock in
 * `src/features/wallet/transfers.ts`, which also holds off a concurrent dissolve
 * until the movement commits.
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
 * `SUM(amount_minor) WHERE status = 'completed'` per `(owner, asset)` — two
 * writers racing on `balance = balance + x` (a desk check-in accrual and a
 * Stripe webhook retry) lose money silently, and a stored total tells you
 * nothing about how it got there. `(user_id, asset)` and `(team_id, asset)` are indexed for it; if the
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
    /** The runner whose wallet this row moves; null when the owner is a team. */
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    /**
     * The team whose treasury this row moves; null when the owner is a runner.
     * Deliberately not a foreign key — see the table comment.
     */
    teamId: uuid("team_id"),
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
     * The person who caused a manual movement — the admin who entered an
     * adjustment, or the runner who contributed to or paid out of a treasury;
     * null for system accruals. Audit trail.
     *
     * `set null` rather than `cascade`: deleting that account must never
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
    index("wallet_tx_team_asset_idx")
      .on(table.teamId, table.asset)
      .where(sql`${table.teamId} is not null`),
    index("wallet_tx_team_created_idx")
      .on(table.teamId, table.createdAt)
      .where(sql`${table.teamId} is not null`),
    check("wallet_tx_one_owner", sql`(${table.userId} is null) <> (${table.teamId} is null)`),
  ],
);

export type WalletTransactionRow = typeof walletTransactions.$inferSelect;
