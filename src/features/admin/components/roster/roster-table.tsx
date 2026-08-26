"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, ChevronUp } from "lucide-react";

import { adminButton } from "@/features/admin/components/shell/admin-button";
import { ADMIN_NOTE } from "@/features/admin/components/shell/admin-card";
import { AdminField, adminInput } from "@/features/admin/components/shell/admin-field";
import { ParticipationBadge } from "@/features/admin/components/shell/participation-badge";
import type {
  ParticipationStatus,
  RosterSort,
  RosterSortKey,
} from "@/features/admin/events-data";
import { assignToHeat } from "@/features/admin/heat-actions";
import type { HeatOption, RosterRowView } from "@/features/admin/roster-view";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import { RosterDrawer } from "./roster-drawer";

/**
 * The roster table, its two interactions, and nothing else.
 *
 * A client island because both interactions are local state and neither belongs
 * in the URL: **which registration is open** in the detail drawer, and **which
 * rows are ticked** for a bulk move. Everything the table renders is computed
 * server-side and handed over as plain strings (`RosterRowView`), so no admin
 * data module and no `roster-query` href helper crosses into the browser bundle —
 * the sort links arrive already built.
 *
 * The list state itself — search, filter, sort, page — stays entirely in the URL
 * where slice #40 put it. Opening a drawer or ticking a row changes no param, so
 * closing the drawer leaves the exact view the admin was reading.
 *
 * Selection is a `Set<registrationId>` mirrored into hidden inputs on the
 * bulk-move form — the heat builder's idiom, and for the same HTML reason: the
 * row checkboxes cannot live *inside* that form, so they are plain client state
 * and the form carries their ids. It posts to the builder's own `assignToHeat`,
 * which means capacity behaviour and the "to notify" flagging are inherited
 * rather than re-implemented here, and the confirmation lands on the Heats tab
 * that action redirects to.
 *
 * There is deliberately **no bulk remove and no bulk no-show**: removing or
 * absenting a runner stays one deliberate act behind a confirm dialog, in the
 * drawer.
 *
 * What renders depends on the reader's admin level, because a control whose
 * action would 404 is worse than no control: without `edit` the bulk-move bar
 * and the row checkboxes that feed it are gone (selection has nothing to do),
 * and without `checkin` the drawer's status action goes too. The table itself —
 * search, sort, page, drawer — is the same read for every level.
 *
 * `data-roster-*` markers are stable hooks for end-to-end checks — a streamed
 * page cannot be told apart by status code, so assertions grep for content.
 */
export function RosterTable({
  rows,
  slug,
  locale,
  statusFilter,
  sort,
  sortHrefs,
  heats,
  canEdit,
  canCheckin,
}: {
  rows: RosterRowView[];
  slug: string;
  locale: string;
  /** The active status filter, which the remove action carries back. */
  statusFilter?: ParticipationStatus;
  sort: RosterSort;
  /** Where each column header points — built by the page from `rosterHref`. */
  sortHrefs: Record<RosterSortKey, string>;
  heats: HeatOption[];
  /** Seeding into heats and removing a registration ask for `edit`. */
  canEdit: boolean;
  /** The drawer's no-show / undo are the desk's actions, gated at `checkin`. */
  canCheckin: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);

  /**
   * The selection as the form posts it: ticked ids **that are on this page**, in
   * the order they are shown.
   *
   * Navigating to another page, search or sort re-renders this island in place
   * (client navigation keeps its state), so the raw set can outlive the rows it
   * was made from. Deriving through `rows` means the count always says how many
   * ticked boxes the admin can see, and a hidden id can never ride along in a
   * post — while stepping back to the page it came from restores it.
   */
  const selectedOnPage = useMemo(
    () => rows.filter((r) => selected.has(r.id)).map((r) => r.id),
    [rows, selected],
  );

  /** The row whose drawer is open, if it is still in the list. */
  const openRow = useMemo(() => rows.find((r) => r.id === openId) ?? null, [rows, openId]);

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
      const allOn = rows.length > 0 && rows.every((r) => next.has(r.id));
      for (const row of rows) {
        if (allOn) next.delete(row.id);
        else next.add(row.id);
      }
      return next;
    });
  }

  const allShown = rows.length > 0 && selectedOnPage.length === rows.length;

  return (
    <>
      <section className="overflow-hidden rounded-admin-lg border border-admin-line bg-admin-surface">
        {canEdit ? (
          <BulkAssign
            slug={slug}
            locale={locale}
            ids={selectedOnPage}
            heats={heats}
            onClear={() => setSelected(new Set())}
          />
        ) : null}

        <div className="admin-scroll overflow-x-auto">
          <table data-roster-table className="w-full border-collapse text-left">
            <thead className="border-b border-admin-line bg-admin-surface-2">
              <tr>
                {canEdit ? (
                  <th scope="col" className={cn(HEAD_CELL, "w-[44px] pr-0")}>
                    <input
                      type="checkbox"
                      checked={allShown}
                      onChange={toggleShown}
                      ref={(el) => {
                        if (el) el.indeterminate = selectedOnPage.length > 0 && !allShown;
                      }}
                      aria-label={allShown ? "Clear this page" : "Select this page"}
                      data-roster-select-page={
                        allShown ? "all" : selectedOnPage.length > 0 ? "some" : "none"
                      }
                      className="h-3.5 w-3.5 accent-admin-accent"
                    />
                  </th>
                ) : null}
                <SortHeader sort={sort} hrefs={sortHrefs} sortKey="bib" label="Bib" className="w-[68px]" />
                <SortHeader sort={sort} hrefs={sortHrefs} sortKey="name" label="Runner" />
                <PlainHeader label="Club" className="hidden lg:table-cell" />
                <PlainHeader label="Cat." className="hidden w-[92px] sm:table-cell" />
                <SortHeader
                  sort={sort}
                  hrefs={sortHrefs}
                  sortKey="best"
                  label="Season best"
                  className="hidden w-[120px] sm:table-cell"
                />
                <SortHeader
                  sort={sort}
                  hrefs={sortHrefs}
                  sortKey="status"
                  label="Status"
                  className="w-[130px]"
                />
                <SortHeader
                  sort={sort}
                  hrefs={sortHrefs}
                  sortKey="registered-at"
                  label="Registered"
                  className="hidden w-[150px] md:table-cell"
                />
                <PlainHeader label="Checked in" className="hidden w-[150px] xl:table-cell" />
                <th scope="col" className="w-[36px]">
                  <span className="sr-only">Detail</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-line">
              {rows.map((row) => (
                <RosterTableRow
                  key={row.id}
                  row={row}
                  ticked={selected.has(row.id)}
                  onToggle={toggle}
                  onOpen={setOpenId}
                  selectable={canEdit}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {openRow ? (
        <RosterDrawer
          row={openRow}
          slug={slug}
          locale={locale}
          statusFilter={statusFilter}
          onClose={() => setOpenId(null)}
          canEdit={canEdit}
          canCheckin={canCheckin}
        />
      ) : null}
    </>
  );
}

/* ── bulk assign ────────────────────────────────────────────────────── */

/**
 * Seed the ticked runners into one heat.
 *
 * The action is the heat builder's `assignToHeat`, unchanged and untouched: the
 * ids travel as repeated hidden `registrationIds`, so capacity behaviour and the
 * publish/notify semantics are whatever that action already does — a runner moved
 * into a published heat comes out "to notify" because their notified heat no
 * longer matches the one they are in, not because anything here computed that.
 * It also redirects where it always redirected, which is why the note says so:
 * the move is confirmed on the Heats tab, in the card it landed in.
 *
 * **Capacity is stated, not enforced.** `assignToHeat` writes `heat_id`
 * unconditionally, and the builder has never refused an overfill either — it
 * renders one, as a red fill meter on the card. Refusing the move here would make
 * the two paths disagree about what a bulk move means, so this says what the move
 * would do to the target instead, before it is pressed. Issue #41's criterion
 * expects a rejection to inherit; there is none to inherit, and that is surfaced
 * on the issue rather than invented here.
 *
 * The bar is always here rather than appearing with the first tick — the picker
 * is how an admin discovers that seeding from the roster is possible at all, and
 * a control that arrives under the cursor moves the table.
 */
function BulkAssign({
  slug,
  locale,
  ids,
  heats,
  onClear,
}: {
  slug: string;
  locale: string;
  ids: string[];
  heats: HeatOption[];
  onClear: () => void;
}) {
  const [heatId, setHeatId] = useState(heats[0]?.id ?? "");
  const none = ids.length === 0;

  // The picker is controlled so the note underneath can talk about the heat that
  // is actually selected. `heats` comes from the same request as the rows, so a
  // stale id is not reachable without a re-render that resets this.
  const target = heats.find((heat) => heat.id === heatId) ?? heats[0] ?? null;
  const after = target ? target.fill + ids.length : 0;
  const over = target !== null && after > target.capacity;

  return (
    <form
      action={assignToHeat}
      data-roster-bulk
      className="flex flex-wrap items-end gap-x-2.5 gap-y-3 border-b border-admin-line p-4"
    >
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="slug" value={slug} />
      {ids.map((id) => (
        <input key={id} type="hidden" name="registrationIds" value={id} />
      ))}

      <AdminField label="Move to heat" className="w-full sm:w-[300px]">
        <select
          name="heatId"
          className={adminInput()}
          value={heatId}
          onChange={(e) => setHeatId(e.target.value)}
          disabled={heats.length === 0}
        >
          {heats.map((heat) => (
            <option key={heat.id} value={heat.id}>
              {heat.label}
              {heat.published ? " · published" : ""}
            </option>
          ))}
        </select>
      </AdminField>

      <button type="submit" className={adminButton("primary")} disabled={none || heats.length === 0}>
        Move {none ? "" : ids.length} to heat
      </button>
      <button type="button" className={adminButton("quiet")} onClick={onClear} disabled={none}>
        Clear
      </button>

      <p
        data-roster-selected={ids.length}
        className={cn(
          "ml-auto self-center font-mono text-[10px] font-medium uppercase tracking-[0.16em]",
          none ? "text-admin-muted" : "text-admin-ink",
        )}
      >
        {ids.length} selected
      </p>

      <p
        data-roster-bulk-note={over ? "over-capacity" : "idle"}
        className={cn(ADMIN_NOTE, "w-full", over && "text-admin-warn")}
      >
        {heats.length === 0
          ? "No heats to seed into yet — lay the card out on the Heats tab first."
          : over
            ? `That would put ${after} runners in a ${target.capacity}-lane heat. Nothing blocks it — the Heats tab never has either — so the card will show it over capacity.`
            : "Tick runners to seed them into a heat. This is the Heats tab's own move, so it confirms there — and a runner moved into a published heat is flagged to notify on the next publish press."}
      </p>
    </form>
  );
}

/* ── table ──────────────────────────────────────────────────────────── */

const HEAD_CELL =
  "px-3 py-2.5 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-admin-muted";

function PlainHeader({ label, className }: { label: string; className?: string }) {
  return (
    <th scope="col" className={cn(HEAD_CELL, className)}>
      {label}
    </th>
  );
}

/**
 * A column header that is also the control for ordering by it: click to sort
 * ascending, click the sorted column again to flip. The direction is stated
 * twice — as an arrow for the eye and as `aria-sort` for a screen reader — and
 * the link is just a URL, so sorting survives a hard reload like everything else
 * here. The URL itself is built by the page; this only knows where to point.
 */
function SortHeader({
  sort,
  hrefs,
  sortKey,
  label,
  className,
}: {
  sort: RosterSort;
  hrefs: Record<RosterSortKey, string>;
  sortKey: RosterSortKey;
  label: string;
  className?: string;
}) {
  const active = sort.key === sortKey;
  const Arrow = active && sort.dir === "desc" ? ChevronDown : ChevronUp;

  return (
    <th
      scope="col"
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
      className={cn(HEAD_CELL, "p-0", className)}
    >
      <Link
        href={hrefs[sortKey]}
        data-roster-sort={sortKey}
        data-active={active ? "true" : "false"}
        data-dir={active ? sort.dir : undefined}
        className={cn(
          "flex w-full items-center gap-1 px-3 py-2.5 transition-colors hover:text-admin-ink",
          active && "text-admin-ink",
        )}
      >
        {label}
        <Arrow className={cn("h-3 w-3 shrink-0", active ? "opacity-100" : "opacity-0")} aria-hidden />
      </Link>
    </th>
  );
}

const CELL = "px-3 py-2.5 align-middle text-[13px] text-admin-ink-2";

/**
 * One runner. The whole row opens the drawer, and the name is a real button
 * inside it so the keyboard and a screen reader have the same affordance the
 * pointer does; the checkbox cell stops the click, because ticking a row is not
 * asking to read it.
 *
 * Contact is not here at all any more — email, phone and the raw date of birth
 * are the drawer's, which is what keeps this table to the columns an admin scans
 * rather than reads. Nothing is lost: the search still matches email, and the
 * xlsx export still carries every field in full.
 */
function RosterTableRow({
  row,
  ticked,
  onToggle,
  onOpen,
  selectable,
}: {
  row: RosterRowView;
  ticked: boolean;
  onToggle: (id: string) => void;
  onOpen: (id: string) => void;
  /** False without `edit`: there is no bulk move for the tick to feed. */
  selectable: boolean;
}) {
  return (
    <tr
      data-roster-row={row.id}
      data-selected={ticked ? "true" : "false"}
      onClick={() => onOpen(row.id)}
      className={cn(
        "group cursor-pointer transition-colors",
        ticked ? "bg-admin-accent-soft" : "hover:bg-admin-surface-2",
      )}
    >
      {selectable ? (
        <td className={cn(CELL, "pr-0")} onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={ticked}
            onChange={() => onToggle(row.id)}
            aria-label={`Select ${row.name}`}
            className="h-3.5 w-3.5 accent-admin-accent"
          />
        </td>
      ) : null}
      {/* A bib is a lease (ADR 0003), so this column shows two different facts:
          the number a runner is wearing, and the number a runner wore. The
          second is dimmed — otherwise the table reads as if half the pool is
          still out, and a desk search for that number would find nobody. */}
      <td
        className={cn(
          CELL,
          "font-mono tabular-nums",
          row.holdsBib ? "text-admin-ink" : "text-admin-muted",
        )}
        title={row.bib !== null && !row.holdsBib ? "Returned to the pool" : undefined}
      >
        {row.bib ?? "—"}
      </td>
      <td className={CELL}>
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={() => onOpen(row.id)}
          className="block max-w-full truncate text-left font-sans text-[13px] font-medium normal-case not-italic text-admin-ink underline decoration-transparent decoration-dotted underline-offset-[3px] transition-colors group-hover:decoration-admin-line-2"
        >
          {row.name}
        </button>
      </td>
      <td className={cn(CELL, "hidden lg:table-cell")}>{row.club || "—"}</td>
      <td className={cn(CELL, "hidden sm:table-cell")}>
        {row.category || "—"}
        {row.sex ? <span className="text-admin-muted"> · {row.sex}</span> : null}
      </td>
      {/* The qualification evidence beside the entry: their best mile from the
          rest of the season, or a dash for a runner with no matched result. */}
      <td
        className={cn(
          CELL,
          "hidden whitespace-nowrap font-mono tabular-nums sm:table-cell",
          row.seasonBest === null && "text-admin-muted",
        )}
      >
        {row.seasonBest ?? "—"}
      </td>
      <td className={CELL}>
        <ParticipationBadge status={row.status} />
      </td>
      <td className={cn(CELL, "hidden whitespace-nowrap text-admin-muted md:table-cell")}>
        {row.registeredAt}
      </td>
      <td className={cn(CELL, "hidden whitespace-nowrap text-admin-muted xl:table-cell")}>
        {row.checkedInAt}
      </td>
      <td className={cn(CELL, "pl-0 text-right")}>
        <ChevronRight
          aria-hidden
          className="inline h-4 w-4 text-admin-muted opacity-0 transition-opacity group-hover:opacity-100"
        />
      </td>
    </tr>
  );
}
