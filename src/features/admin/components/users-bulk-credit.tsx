"use client";

import { useMemo, useState } from "react";

import { ConfirmSubmit } from "@/features/admin/components/confirm-submit";
import { adminButton } from "@/features/admin/components/shell/admin-button";
import { ADMIN_NOTE } from "@/features/admin/components/shell/admin-card";
import { AdminField, adminInput } from "@/features/admin/components/shell/admin-field";
import { resendUserVerification } from "@/features/admin/users-actions";
import type { UserSort, UserSortKey } from "@/features/admin/users-data";
import { creditWalletBulk } from "@/features/admin/wallet-actions";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * The users table, its selection, and the bulk ACER grant that selection feeds.
 *
 * A client island for one reason: **which rows are ticked** is local state that
 * does not belong in the URL — the roster's reasoning (#41), and the same
 * mechanism. Everything else about this list — search, filters, sort, page —
 * stays in the query string where it has always been, so the sort links arrive
 * already built (`sortHrefs`) and no admin data module crosses into the browser
 * bundle. The caps travel as props for the same reason: `wallet-data.ts` opens a
 * database connection, so importing a number out of it here would drag the
 * driver into the client.
 *
 * The table keeps its `.iv-*` markup — this page is not redesigned (ADR 0004
 * freezes those classes rather than forbidding them), and moving it into the
 * island is a change of *where* it renders, not of how it looks. The bar the
 * island adds is new admin UI, so it is built in the Tailwind admin layer, the
 * way `wallet-panel.tsx` already sits beside old markup on the detail page.
 *
 * Selection is **per page**: the ids that post are derived through `rows`, so a
 * tick the admin cannot see can never ride along in a grant, and the bar says
 * which scope it is counting. Ticking survives a client navigation because the
 * island stays mounted; stepping back to a page restores what was ticked there.
 *
 * `data-users-*` markers are stable hooks for end-to-end checks — a streamed
 * page cannot be told apart by status code, so assertions grep for content.
 */

/** One row of the users list, with every cell already rendered to a string. */
export type UserRowView = {
  id: string;
  name: string;
  email: string;
  /** Empty when the account has no phone. */
  phone: string;
  /** Signup date, formatted server-side. */
  signedUp: string;
  emailVerified: boolean;
  profileComplete: boolean;
  /** true = attended, false = no-show, null = no first-event participation. */
  firstEventAttended: boolean | null;
  augRegistrationCount: number;
  raceCount: number;
  /** ACER balance, formatted for the English admin UI. */
  acerBalance: string;
  /** The same balance in minor units — the marker an assertion reads. */
  acerBalanceMinor: number;
};

export function UsersBulkCredit({
  rows,
  locale,
  sort,
  sortHrefs,
  canEdit,
  batchId,
  listQuery,
  maxAmount,
  maxReason,
  maxRecipients,
}: {
  rows: UserRowView[];
  locale: string;
  sort: UserSort;
  /** Where each sortable column header points — built by the page. */
  sortHrefs: Record<UserSortKey, string>;
  /** Crediting asks for `edit`; without it there are no checkboxes and no bar. */
  canEdit: boolean;
  /** The uuid tying this render's grant together, minted by the server. */
  batchId: string;
  /** The list's current query string, so the action's redirect lands back here. */
  listQuery: string;
  maxAmount: number;
  maxReason: number;
  maxRecipients: number;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  /**
   * What the form posts: ticked ids **that are on this page**, in the order
   * they are shown. Derived through `rows` rather than read off the raw set,
   * because paging and filtering re-render this island in place and the set can
   * outlive the rows it was made from.
   */
  const ids = useMemo(
    () => rows.filter((row) => selected.has(row.id)).map((row) => row.id),
    [rows, selected],
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /** Tick every row on this page, or clear them if they are all already ticked. */
  function toggleShown() {
    setSelected((prev) => {
      const next = new Set(prev);
      const allOn = rows.length > 0 && rows.every((row) => next.has(row.id));
      for (const row of rows) {
        if (allOn) next.delete(row.id);
        else next.add(row.id);
      }
      return next;
    });
  }

  const allShown = rows.length > 0 && ids.length === rows.length;

  return (
    <section className="iv-card" style={{ marginTop: 18 }}>
      {canEdit ? (
        <BulkCreditBar
          locale={locale}
          ids={ids}
          batchId={batchId}
          listQuery={listQuery}
          maxAmount={maxAmount}
          maxReason={maxReason}
          maxRecipients={maxRecipients}
          onClear={() => setSelected(new Set())}
        />
      ) : null}

      <div className="iv-tablewrap">
        <table className="iv-table" data-users-table>
          <thead>
            <tr>
              {canEdit ? (
                <th style={{ width: 36 }}>
                  <input
                    type="checkbox"
                    checked={allShown}
                    onChange={toggleShown}
                    ref={(el) => {
                      if (el) el.indeterminate = ids.length > 0 && !allShown;
                    }}
                    aria-label={allShown ? "Clear this page" : "Select this page"}
                    data-users-select-page={
                      allShown ? "all" : ids.length > 0 ? "some" : "none"
                    }
                  />
                </th>
              ) : null}
              <SortHeader sort={sort} hrefs={sortHrefs} sortKey="name" label="Name" />
              <th>Email</th>
              <th>Phone</th>
              <SortHeader sort={sort} hrefs={sortHrefs} sortKey="signed-up" label="Signed up" />
              <th>Verified</th>
              <th>Profile</th>
              <th>First event</th>
              <th>Aug regs</th>
              <th>Races run</th>
              <th data-users-acer-head>ACER</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <UserRow
                key={row.id}
                row={row}
                locale={locale}
                canEdit={canEdit}
                ticked={selected.has(row.id)}
                onToggle={toggle}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ── bulk grant bar ─────────────────────────────────────────────────── */

/**
 * Credit the ticked people, once, with a reason.
 *
 * The bar is always here rather than appearing with the first tick — it is how
 * an admin discovers that crediting from the list is possible at all, and a
 * control that arrives under the cursor moves the table. With nothing ticked the
 * submit is a disabled button rather than the confirm trigger, so there is
 * nothing to press and nothing for the keyboard to land on.
 *
 * The amount is controlled state only so the confirmation can quote it: "credit
 * 100 ACER to 12 people" is a sentence an admin can check, "credit the amount
 * above" is not. `required`, `min` and `max` are real HTML constraints —
 * `ConfirmSubmit` submits through `requestSubmit()`, which runs them — so the
 * field refuses what the action would refuse, in the field rather than as a
 * sentence on the next page.
 */
function BulkCreditBar({
  locale,
  ids,
  batchId,
  listQuery,
  maxAmount,
  maxReason,
  maxRecipients,
  onClear,
}: {
  locale: string;
  ids: string[];
  batchId: string;
  listQuery: string;
  maxAmount: number;
  maxReason: number;
  maxRecipients: number;
  onClear: () => void;
}) {
  const [amount, setAmount] = useState("");
  const none = ids.length === 0;
  const people = `${ids.length} ${ids.length === 1 ? "person" : "people"}`;

  return (
    <form
      action={creditWalletBulk}
      data-users-bulk
      className="mb-4 flex flex-wrap items-end gap-x-2.5 gap-y-3 border-b border-admin-line pb-4"
    >
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="batchId" value={batchId} />
      <input type="hidden" name="listQuery" value={listQuery} />
      {ids.map((id) => (
        <input key={id} type="hidden" name="userIds" value={id} />
      ))}

      <AdminField label="Credit (ACER)" className="w-[150px]">
        <input
          className={adminInput()}
          name="amount"
          type="number"
          inputMode="numeric"
          min={1}
          max={maxAmount}
          step={1}
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="e.g. 100"
        />
      </AdminField>

      <AdminField label="Reason" className="w-full sm:w-[320px]">
        <input
          className={adminInput()}
          name="reason"
          maxLength={maxReason}
          required
          placeholder="Why these people are being credited"
        />
      </AdminField>

      {none ? (
        <button type="button" className={adminButton("primary")} disabled>
          Credit people
        </button>
      ) : (
        <ConfirmSubmit
          label={`Credit ${people}`}
          title="Credit ACER"
          message={`Credit ${amount.trim() || "the amount entered"} ACER to ${people}. Every row is recorded against your account with the reason you gave, and a grant is undone one row at a time.`}
          confirmLabel="Credit"
          danger={false}
          triggerClassName={adminButton("primary")}
        />
      )}
      <button type="button" className={adminButton("quiet")} onClick={onClear} disabled={none}>
        Clear
      </button>

      <p
        data-users-selected={ids.length}
        className={cn(
          "ml-auto self-center font-mono text-[10px] font-medium uppercase tracking-[0.16em]",
          none ? "text-admin-muted" : "text-admin-ink",
        )}
      >
        {ids.length} selected on this page
      </p>

      <p data-users-bulk-note className={cn(ADMIN_NOTE, "w-full")}>
        Selection is per page — ticks on another page are not credited, and at most{" "}
        {maxRecipients} people go in one grant. Pressing this twice credits once; reload the
        list to grant the same people again.
      </p>
    </form>
  );
}

/* ── table ──────────────────────────────────────────────────────────── */

/**
 * A column header that is also the control for ordering by it: click to sort
 * ascending, click the sorted column again to flip. The direction is stated
 * twice — as an arrow for the eye and as `aria-sort` for a screen reader — and
 * the link is just a URL, so sorting survives a reload like every other bit of
 * this page's state. The URL itself is built by the page; this only knows where
 * to point.
 */
function SortHeader({
  sort,
  hrefs,
  sortKey,
  label,
}: {
  sort: UserSort;
  hrefs: Record<UserSortKey, string>;
  sortKey: UserSortKey;
  label: string;
}) {
  const active = sort.key === sortKey;
  return (
    <th aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
      <Link
        href={hrefs[sortKey]}
        className="iv-linkbtn"
        data-users-sort={sortKey}
        data-active={active ? "true" : "false"}
      >
        {label}
        {active ? <span aria-hidden> {sort.dir === "asc" ? "↑" : "↓"}</span> : null}
      </Link>
    </th>
  );
}

function FirstEventBadge({ attended }: { attended: boolean | null }) {
  if (attended === null) return <span className="iv-cellsub">—</span>;
  return (
    <span className={`iv-pill ${attended ? "iv-pill--ok" : "iv-pill--red"}`}>
      {attended ? "attended" : "no-show"}
    </span>
  );
}

function UserRow({
  row,
  locale,
  canEdit,
  ticked,
  onToggle,
}: {
  row: UserRowView;
  locale: string;
  canEdit: boolean;
  ticked: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <tr data-users-row={row.id} data-selected={ticked ? "true" : "false"}>
      {canEdit ? (
        <td>
          <input
            type="checkbox"
            checked={ticked}
            onChange={() => onToggle(row.id)}
            aria-label={`Select ${row.name}`}
            data-users-select={row.id}
          />
        </td>
      ) : null}
      <td>
        <Link href={`/admin/users/${row.id}`} className="iv-linkbtn">
          {row.name}
        </Link>
      </td>
      <td>{row.email}</td>
      <td>{row.phone || <span className="iv-cellsub">—</span>}</td>
      <td>{row.signedUp}</td>
      <td>
        <span className={`iv-pill ${row.emailVerified ? "iv-pill--ok" : "iv-pill--due"}`}>
          {row.emailVerified ? "verified" : "unverified"}
        </span>
      </td>
      <td>
        {/* The same gate the runner meets at registration: without these five
            fields they cannot enter an event, whatever their email says. */}
        <span className={`iv-pill ${row.profileComplete ? "iv-pill--ok" : "iv-pill--due"}`}>
          {row.profileComplete ? "complete" : "incomplete"}
        </span>
      </td>
      <td>
        <FirstEventBadge attended={row.firstEventAttended} />
      </td>
      <td>{row.augRegistrationCount}</td>
      <td>{row.raceCount}</td>
      <td data-users-acer={row.acerBalanceMinor}>{row.acerBalance}</td>
      <td>
        <div className="iv-inline">
          <Link href={`/admin/users/${row.id}`} className="iv-linkbtn">
            View
          </Link>
          {canEdit && !row.emailVerified ? (
            <form action={resendUserVerification}>
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="id" value={row.id} />
              <input type="hidden" name="redirectTo" value="" />
              <button type="submit" className="iv-linkbtn">
                Resend verification
              </button>
            </form>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
