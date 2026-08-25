import { WALLET_ASSETS } from "@/db/schema";
import type { WalletBalances } from "@/features/wallet/data";
import { formatWalletAmount, formatWalletBalance } from "@/features/wallet/format";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import { formatAdminDateTime as fmt } from "../format";
import { ConfirmSubmit } from "./confirm-submit";
import { adjustWalletBalance, reverseWalletTransaction } from "../wallet-actions";
import { WALLET_ASSET_LABEL, WALLET_KIND_LABEL, WALLET_STATUS_LABEL } from "../wallet-copy";
import {
  MAX_ADJUSTMENT_ACER,
  MAX_REASON_LENGTH,
  type AdminWalletEntry,
  type AdminWalletLedgerPage,
} from "../wallet-data";
import { adminButton } from "./shell/admin-button";
import { ADMIN_NOTE, ADMIN_TITLE, adminCard } from "./shell/admin-card";
import { AdminField, adminInput } from "./shell/admin-field";
import { AdminPill } from "./shell/admin-pill";
import { AdminStat } from "./shell/admin-stat";

const HEAD_CELL =
  "px-3 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-admin-muted";
const CELL = "px-3 py-2 align-top text-[13px] text-admin-ink-2";

/** How a row's status reads as a pill. Only `completed` counts toward a balance. */
const STATUS_TONE = { completed: "ok", pending: "warn", failed: "warn" } as const;

/**
 * The wallet panel on a user's detail page: their three balances, their full
 * ledger, and the two write actions — a manual credit/debit and the reversal
 * that corrects a wrong row.
 *
 * Built in the Tailwind admin layer (ADR 0004) rather than the `.iv-*` classes
 * its sibling cards on this not-yet-redesigned page still use: the ADR freezes
 * `.iv-*` for admin, and new admin UI goes in the new layer even when it lands
 * beside the old one.
 *
 * English-only, like the rest of the panel. Amounts are formatted by the wallet
 * feature's own formatters (pinned to `en`) so an admin and the runner they are
 * on the phone with read the same number the same way.
 *
 * `canEdit` is the `edit` capability, resolved by the page: a view-only or
 * check-in admin reads the ledger and is offered no forms. The actions re-check
 * it themselves — the hidden forms are a courtesy, not the gate.
 */
export function WalletPanel({
  userId,
  locale,
  balances,
  ledger,
  canEdit,
}: {
  userId: string;
  locale: string;
  balances: WalletBalances;
  ledger: AdminWalletLedgerPage;
  canEdit: boolean;
}) {
  return (
    <section className={adminCard("mt-4 p-4 sm:p-5")} id="wallet" data-admin-wallet>
      <h2 className={ADMIN_TITLE}>Wallet</h2>
      <p className={cn(ADMIN_NOTE, "mt-1.5 max-w-[78ch]")}>
        Balances are the sum of the completed rows below — there is no stored total. Pending and
        failed rows are listed but count toward nothing. Corrections are new rows, never edits: a
        reversal leaves both rows visible and nets them to zero.
      </p>

      <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
        {WALLET_ASSETS.map((asset) => (
          <AdminStat
            key={asset}
            label={WALLET_ASSET_LABEL[asset]}
            value={formatWalletBalance(balances[asset], "en")}
          />
        ))}
      </div>

      {canEdit ? <AdjustForm userId={userId} locale={locale} page={ledger.page} /> : null}

      <h3 className={cn(ADMIN_TITLE, "mt-6")}>Transactions</h3>
      {ledger.total === 0 ? (
        <p className={cn(ADMIN_NOTE, "mt-2")}>No wallet transactions yet.</p>
      ) : (
        <>
          <div className="admin-scroll mt-3 overflow-x-auto rounded-admin-lg border border-admin-line">
            <table className="w-full border-collapse text-left" data-admin-wallet-ledger>
              <thead className="border-b border-admin-line bg-admin-surface-2">
                <tr>
                  {[
                    "When",
                    "Purpose",
                    "Asset",
                    "Amount",
                    "Status",
                    "Reason & author",
                    "Correction",
                  ].map((head) => (
                    <th scope="col" className={HEAD_CELL} key={head}>
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ledger.rows.map((tx) => (
                  <LedgerRow
                    key={tx.id}
                    tx={tx}
                    userId={userId}
                    locale={locale}
                    page={ledger.page}
                    canEdit={canEdit}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <LedgerPager userId={userId} ledger={ledger} />
        </>
      )}
    </section>
  );
}

/**
 * The manual adjustment. One **signed** whole-ACER field rather than a
 * credit/debit switch plus a magnitude: the ledger row is a signed amount, and a
 * form that mirrors the row is a form whose effect an admin can read off it.
 */
function AdjustForm({ userId, locale, page }: { userId: string; locale: string; page: number }) {
  return (
    <form action={adjustWalletBalance} className="mt-4 flex flex-wrap items-end gap-2.5">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="id" value={userId} />
      <input type="hidden" name="wpage" value={page} />
      {/* ACER only. The action validates every asset the ledger knows — the
          Contracts signature is asset-generic — but nothing may *issue*
          Ace(PL) or ACEG yet (PRD #44, Out of Scope), and the runner's wallet
          promises both read 0. Offering them here would make one mis-click the
          rule that creates them. */}
      <input type="hidden" name="asset" value="ACER" />
      <AdminField label="Asset" className="w-[130px]">
        <input className={adminInput()} value={WALLET_ASSET_LABEL.ACER} disabled readOnly />
      </AdminField>
      <AdminField label="ACER (− to debit)" className="w-[130px]">
        <input
          className={adminInput()}
          type="number"
          name="amount"
          step={1}
          min={-MAX_ADJUSTMENT_ACER}
          max={MAX_ADJUSTMENT_ACER}
          placeholder="10"
        />
      </AdminField>
      <AdminField label="Reason (required)" className="w-full sm:min-w-[240px] sm:flex-1">
        <input
          className={adminInput()}
          type="text"
          name="reason"
          maxLength={MAX_REASON_LENGTH}
          placeholder="Why this adjustment is being made"
        />
      </AdminField>
      {/* Confirmed like the panel's other consequential presses: this moves
          money, and a mistyped amount is only undone by a permanent reversal
          row. */}
      <ConfirmSubmit
        label="Apply adjustment"
        title="Apply this adjustment?"
        message="The amount is credited (or debited) immediately and appears in the runner's own wallet history. Correcting it later means a reversal row, which stays visible forever."
        confirmLabel="Apply adjustment"
        danger={false}
        triggerClassName={adminButton("primary")}
      />
    </form>
  );
}

function LedgerRow({
  tx,
  userId,
  locale,
  page,
  canEdit,
}: {
  tx: AdminWalletEntry;
  userId: string;
  locale: string;
  page: number;
  canEdit: boolean;
}) {
  // A manual row whose author's account is gone keeps its `memo`, so it stays
  // explainable — say that rather than rendering an anonymous entry.
  const author = tx.authorName ?? (tx.createdBy ? "deleted admin" : null);
  return (
    <tr className="border-admin-line/60 border-b last:border-b-0">
      <td className={CELL}>
        <span className="whitespace-nowrap text-admin-ink">{fmt(tx.createdAt)}</span>
        <span className="mt-0.5 block break-all font-mono text-[10px] leading-tight text-admin-muted">
          {tx.id}
        </span>
      </td>
      <td className={cn(CELL, "text-admin-ink")}>
        {WALLET_KIND_LABEL[tx.kind]}
        {tx.reference ? (
          <span className="mt-0.5 block break-all font-mono text-[10px] leading-tight text-admin-muted">
            {tx.reference}
          </span>
        ) : null}
      </td>
      <td className={CELL}>{WALLET_ASSET_LABEL[tx.asset]}</td>
      <td
        className={cn(
          CELL,
          "whitespace-nowrap font-mono",
          tx.amountMinor < 0 ? "text-admin-warn" : "text-admin-ok",
        )}
      >
        {formatWalletAmount(tx.amountMinor, "en")}
      </td>
      <td className={CELL}>
        <AdminPill tone={STATUS_TONE[tx.status]}>{WALLET_STATUS_LABEL[tx.status]}</AdminPill>
      </td>
      <td className={cn(CELL, "min-w-[220px]")}>
        {tx.memo ?? "—"}
        {author ? (
          <span className="mt-0.5 block text-[11px] leading-tight text-admin-muted">
            by {author}
            {tx.authorEmail ? ` (${tx.authorEmail})` : ""}
          </span>
        ) : null}
      </td>
      <td className={CELL}>
        <ReverseCell tx={tx} userId={userId} locale={locale} page={page} canEdit={canEdit} />
      </td>
    </tr>
  );
}

/**
 * The correction column. A row is reversible exactly once and only while it is
 * `completed`; a reversal is not itself reversible (undoing a correction is a
 * fresh decision, so it goes in as a manual entry with its own reason).
 * Everything else this cell renders says *why* there is no button, so the
 * absence never reads as a bug.
 */
function ReverseCell({
  tx,
  userId,
  locale,
  page,
  canEdit,
}: {
  tx: AdminWalletEntry;
  userId: string;
  locale: string;
  page: number;
  canEdit: boolean;
}) {
  if (tx.reversedById) return <AdminPill tone="warn">reversed</AdminPill>;

  if (tx.kind === "reversal") {
    return (
      <span className="block text-[11px] leading-tight text-admin-muted">
        corrects
        <span className="mt-0.5 block break-all font-mono text-[10px]">{tx.reversesId ?? "—"}</span>
      </span>
    );
  }

  if (tx.status !== "completed") {
    return <span className="text-admin-muted">—</span>;
  }

  if (!canEdit) return <span className="text-admin-muted">—</span>;

  return (
    <form action={reverseWalletTransaction} className="flex items-center gap-1.5">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="id" value={userId} />
      <input type="hidden" name="wpage" value={page} />
      <input type="hidden" name="txId" value={tx.id} />
      <input
        className={adminInput("w-[150px]")}
        type="text"
        name="reason"
        maxLength={MAX_REASON_LENGTH}
        placeholder="Reason"
        aria-label={`Reason for reversing transaction ${tx.id}`}
      />
      <ConfirmSubmit
        label="Reverse"
        title="Reverse this transaction?"
        message="An offsetting row is appended. Nothing is edited or deleted — both rows stay in the runner's history and net to zero. A row can only be reversed once."
        confirmLabel="Reverse"
        triggerClassName={adminButton("stroke")}
      />
    </form>
  );
}

/**
 * The panel's own pager. `?wpage=` is the only param it carries — the page's
 * `?msg=` belongs to the action that just ran, and re-attaching it to a page
 * link would re-show a stale sentence. `#wallet` lands back on the panel rather
 * than at the top of a long detail page.
 */
function LedgerPager({ userId, ledger }: { userId: string; ledger: AdminWalletLedgerPage }) {
  const offset = (ledger.page - 1) * ledger.pageSize;
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
      <p className={ADMIN_NOTE} data-admin-wallet-count={ledger.total}>
        Showing {offset + 1}–{offset + ledger.rows.length} of {ledger.total}
      </p>
      {ledger.pageCount > 1 ? (
        <nav aria-label="Wallet transaction pages" className="flex items-center gap-2">
          <PagerLink
            href={`/admin/users/${userId}?wpage=${ledger.page - 1}#wallet`}
            disabled={ledger.page <= 1}
            rel="prev"
          >
            ← Newer
          </PagerLink>
          <span className={ADMIN_NOTE}>
            Page {ledger.page} of {ledger.pageCount}
          </span>
          <PagerLink
            href={`/admin/users/${userId}?wpage=${ledger.page + 1}#wallet`}
            disabled={ledger.page >= ledger.pageCount}
            rel="next"
          >
            Older →
          </PagerLink>
        </nav>
      ) : null}
    </div>
  );
}

/** At either end the control is a `span`, so there is nothing to click or tab to. */
function PagerLink({
  href,
  disabled,
  rel,
  children,
}: {
  href: string;
  disabled: boolean;
  rel: "prev" | "next";
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span aria-disabled className={adminButton("stroke", "opacity-45")}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} rel={rel} className={adminButton("stroke")}>
      {children}
    </Link>
  );
}
