"use client";

import { useMemo, useState } from "react";

import { ConfirmSubmit } from "@/features/admin/components/confirm-submit";
import { adminButton } from "@/features/admin/components/shell/admin-button";
import { ADMIN_NOTE, ADMIN_TITLE, adminCard } from "@/features/admin/components/shell/admin-card";
import { AdminEmptyState } from "@/features/admin/components/shell/admin-empty-state";
import { AdminField, adminInput } from "@/features/admin/components/shell/admin-field";
import { AdminPill, type AdminPillTone } from "@/features/admin/components/shell/admin-pill";
import { ParticipationBadge } from "@/features/admin/components/shell/participation-badge";
import {
  assignBib,
  assignToHeat,
  deleteHeat,
  unassignFromHeat,
  updateHeat,
} from "@/features/admin/heat-actions";
import type { HeatWithFill, SeedRow } from "@/features/admin/heats-data";
import { formatHeatTime, instantToWarsawLocal } from "@/lib/events/heat-time";
import { cn } from "@/lib/utils";

/**
 * The heat builder: one card per heat showing its whole field at once, under an
 * Unassigned card of confirmed-but-unplaced runners. Cards rather than columns
 * because a heat holds up to a bib pool's worth of runners and names in a narrow
 * column are unreadable.
 *
 * Restyled onto the Tailwind admin layer in slice #42 — **mechanics untouched**.
 * The selection still lives here as a `Set<registrationId>` (the
 * recipient-multiselect idiom) mirrored into hidden inputs on the bulk-move form,
 * so one selection spanning several cards can be moved in a single server
 * action. The runner checkboxes deliberately sit *outside* that form — nesting
 * them inside it would nest them inside the per-heat edit forms too, which HTML
 * forbids.
 *
 * Without `edit` the builder becomes the card as a *read*: the filter and every
 * count stay, and the four mutating surfaces — the bulk-move bar, the selection
 * checkboxes that feed it, the per-runner bib lease, and each card's
 * save/delete — are not rendered. Their actions all ask for `edit`, so a
 * view-only admin would only find that out by pressing them.
 *
 * `data-admin-heat` / `data-heat-state` / `data-admin-runner` are stable markers
 * for end-to-end checks: a streamed page cannot be told apart by status code, so
 * the assertions grep for content (see the parent PRD's verification note).
 */
export function HeatBuilder({
  locale,
  slug,
  heats,
  seeds,
  pool,
  canEdit,
}: {
  locale: string;
  slug: string;
  heats: HeatWithFill[];
  seeds: SeedRow[];
  pool: number;
  /** Whether the reader holds `edit`; false renders the card read-only. */
  canEdit: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return new Set(
      seeds
        .filter(
          (s) =>
            s.name.toLowerCase().includes(q) ||
            s.email.toLowerCase().includes(q) ||
            (s.club?.toLowerCase().includes(q) ?? false),
        )
        .map((s) => s.id),
    );
  }, [seeds, query]);

  const shown = useMemo(
    () => (matches ? seeds.filter((s) => matches.has(s.id)) : seeds),
    [seeds, matches],
  );

  const byHeat = useMemo(() => {
    const map = new Map<string, SeedRow[]>();
    for (const s of shown) {
      if (!s.heatId) continue;
      const list = map.get(s.heatId);
      if (list) list.push(s);
      else map.set(s.heatId, [s]);
    }
    return map;
  }, [shown]);

  const unassigned = useMemo(() => shown.filter((s) => !s.heatId), [shown]);

  // Whether a list is empty *because of the filter* — the same trimmed reading
  // `matches` uses, so a whitespace-only query cannot claim "no matches" while
  // the lists are in fact showing everybody.
  const filtering = matches !== null;

  // The badge counts everyone unplaced, not just those surviving the filter —
  // the heat pills show true fill, and a count that shrank as you typed would
  // read as runners disappearing.
  const unassignedTotal = useMemo(() => seeds.filter((s) => !s.heatId).length, [seeds]);

  /**
   * Per heat, how many of its runners a publish press would email — the page's
   * "To notify" stat broken down per card, so the number is visible where the
   * decision is made rather than only in the total. Counted over the whole field
   * for the same reason the unassigned badge is: the filter must not look like it
   * changed what publishing will do. Mirrors the mailing's own filter — a seeded
   * no-show stays on the card to be taken off, but is not mailed.
   */
  const toNotifyByHeat = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of seeds) {
      if (!s.heatId || s.status === "no_show" || s.notifyState === "notified") continue;
      map.set(s.heatId, (map.get(s.heatId) ?? 0) + 1);
    }
    return map;
  }, [seeds]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll(rows: SeedRow[]) {
    setSelected((prev) => {
      const next = new Set(prev);
      const allOn = rows.length > 0 && rows.every((r) => next.has(r.id));
      for (const r of rows) {
        if (allOn) next.delete(r.id);
        else next.add(r.id);
      }
      return next;
    });
  }

  return (
    <>
      {/* ---- filter + bulk move bar ---- */}
      <section className={adminCard("p-4 sm:p-5")}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className={ADMIN_TITLE}>{canEdit ? "Seed runners" : "Find a runner"}</h2>
          {canEdit ? (
            <p
              data-admin-selected={selected.size}
              className={cn(
                "font-mono text-[10px] font-medium uppercase tracking-[0.16em]",
                selected.size > 0 ? "text-admin-ink" : "text-admin-muted",
              )}
            >
              {selected.size} selected
            </p>
          ) : null}
        </div>
        <p className={cn(ADMIN_NOTE, "mt-1.5")}>
          {canEdit
            ? "Tick runners in any list below — the selection spans cards — then move them into a heat or take them off the card."
            : "Filter the lists below to find a runner on the card. Building it is a full-access act."}
        </p>

        <div className="mt-4">
          <AdminField label="Filter" className="max-w-[420px]">
            <input
              type="text"
              className={adminInput()}
              placeholder="Name, email or club…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </AdminField>
        </div>

        {/* One form, two actions: `formAction` on the second button overrides the
            form's own, so a single selection can be moved or cleared. */}
        {canEdit ? (
        <form
          action={assignToHeat}
          className="mt-4 flex flex-wrap items-end gap-2.5 border-t border-admin-line pt-4"
        >
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="slug" value={slug} />
          {/* carries the selection into whichever action the button picks */}
          {[...selected].map((id) => (
            <input key={id} type="hidden" name="registrationIds" value={id} />
          ))}

          <AdminField label="Move to" className="w-full sm:w-[280px]">
            <select
              name="heatId"
              className={adminInput()}
              defaultValue={heats[0]?.id ?? ""}
              disabled={heats.length === 0}
            >
              {heats.map((h) => (
                <option key={h.id} value={h.id}>
                  Heat {h.number} · {formatHeatTime(h.scheduledAt)} · {h.fill}/{h.capacity}
                </option>
              ))}
            </select>
          </AdminField>

          <button
            type="submit"
            className={adminButton("primary")}
            disabled={selected.size === 0 || heats.length === 0}
          >
            Move {selected.size || ""} to heat
          </button>
          <button
            type="submit"
            formAction={unassignFromHeat}
            className={adminButton("stroke")}
            disabled={selected.size === 0}
          >
            Unassign
          </button>
          <button
            type="button"
            className={adminButton("quiet")}
            onClick={() => setSelected(new Set())}
            disabled={selected.size === 0}
          >
            Clear selection
          </button>
        </form>
        ) : null}
      </section>

      {/* ---- unassigned, then one card per heat ---- */}
      <section className={adminCard("mt-4 p-4 sm:p-5")} data-admin-unassigned={unassignedTotal}>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <h3 className={ADMIN_TITLE}>Unassigned</h3>
            <AdminPill tone={unassignedTotal > 0 ? "warn" : "muted"}>{unassignedTotal}</AdminPill>
          </div>
          {canEdit ? (
            <SelectShown
              rows={unassigned}
              selected={selected}
              onToggleAll={() => toggleAll(unassigned)}
            />
          ) : null}
        </div>
        <p className={cn(ADMIN_NOTE, "mt-1.5")}>Confirmed runners not yet in a heat.</p>
        <RunnerGrid
          className="mt-3.5"
          rows={unassigned}
          selected={selected}
          onToggle={toggle}
          emptyText={filtering ? "No matches here." : "Everyone confirmed is placed."}
          locale={locale}
          slug={slug}
          pool={pool}
          canEdit={canEdit}
          scroll
        />
      </section>

      {heats.length === 0 ? (
        <div className="mt-4">
          <AdminEmptyState title="No heats generated yet">
            {canEdit ? (
              <>
                The runners above are waiting for a card. Lay one out with{" "}
                <strong className="font-semibold text-admin-ink-2">Generate heats</strong> at the
                top of this page — then select runners and move them in.
              </>
            ) : (
              <>
                The runners above are waiting for a card. Laying one out is a full-access act — this
                page shows it as soon as it exists.
              </>
            )}
          </AdminEmptyState>
        </div>
      ) : (
        heats.map((heat) => (
          <HeatCard
            key={heat.id}
            locale={locale}
            slug={slug}
            heat={heat}
            pool={pool}
            rows={byHeat.get(heat.id) ?? []}
            toNotify={toNotifyByHeat.get(heat.id) ?? 0}
            selected={selected}
            onToggle={toggle}
            onToggleAll={toggleAll}
            filtering={filtering}
            canEdit={canEdit}
          />
        ))
      )}
    </>
  );
}

/**
 * One heat, in three regions: what it is (number, start, state, fill), its field,
 * and the two forms that change it.
 *
 * Edit and delete are sibling forms, and the runner grid sits outside both,
 * because nesting forms is illegal — that constraint is what shapes the card.
 */
function HeatCard({
  locale,
  slug,
  heat,
  pool,
  rows,
  toNotify,
  selected,
  onToggle,
  onToggleAll,
  filtering,
  canEdit,
}: {
  locale: string;
  slug: string;
  heat: HeatWithFill;
  pool: number;
  rows: SeedRow[];
  toNotify: number;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: (rows: SeedRow[]) => void;
  filtering: boolean;
  canEdit: boolean;
}) {
  const over = heat.fill > heat.capacity;

  return (
    <section
      data-admin-heat={heat.number}
      data-heat-state={heat.state}
      data-heat-fill={`${heat.fill}/${heat.capacity}`}
      className={adminCard(cn("mt-4", over ? "border-admin-accent" : undefined))}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-5 gap-y-4 p-4 sm:p-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h3 className="font-sans text-[17px] font-semibold normal-case not-italic leading-none tracking-[-0.01em] text-admin-ink">
              Heat {heat.number}
            </h3>
            <HeatStateBadge state={heat.state} />
            {toNotify > 0 ? (
              <AdminPill
                tone="warn"
                dot
                title="Runners this heat would email on the next publish press"
              >
                {toNotify} to notify
              </AdminPill>
            ) : null}
          </div>
          <p className="mt-2 font-mono text-[12px] leading-none tracking-[0.06em] text-admin-ink-2">
            {formatHeatTime(heat.scheduledAt)}
            <span className="text-admin-muted"> · start</span>
          </p>
        </div>

        <FillMeter fill={heat.fill} capacity={heat.capacity} />
      </div>

      <div className="border-t border-admin-line p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-admin-muted">
            Field
          </p>
          {canEdit ? (
            <SelectShown rows={rows} selected={selected} onToggleAll={() => onToggleAll(rows)} />
          ) : null}
        </div>
        <RunnerGrid
          className="mt-3"
          rows={rows}
          selected={selected}
          onToggle={onToggle}
          emptyText={
            filtering
              ? "No matches in this heat."
              : canEdit
                ? "Empty — select runners above and move them in."
                : "Empty — nobody is seeded into this heat yet."
          }
          locale={locale}
          slug={slug}
          pool={pool}
          canEdit={canEdit}
        />
      </div>

      {canEdit ? (
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 border-t border-admin-line p-4 sm:px-5">
        <form action={updateHeat} className="flex flex-wrap items-end gap-2.5">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="heatId" value={heat.id} />
          <AdminField label="Start" className="w-full sm:w-[210px]">
            <input
              className={adminInput()}
              type="datetime-local"
              name="scheduledAt"
              defaultValue={instantToWarsawLocal(heat.scheduledAt)}
            />
          </AdminField>
          <AdminField label="Cap." className="w-[84px]">
            <input
              className={adminInput()}
              type="number"
              name="capacity"
              min={1}
              max={pool}
              defaultValue={heat.capacity}
            />
          </AdminField>
          <button type="submit" className={adminButton("stroke")}>
            Save
          </button>
        </form>
        <form action={deleteHeat}>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="heatId" value={heat.id} />
          <ConfirmSubmit
            label="Delete heat"
            title={`Delete heat ${heat.number}?`}
            message="Its runners go back to Unassigned. Registrations are not deleted, and the remaining heats keep their numbers."
            confirmLabel="Delete heat"
            triggerClassName={adminButton(
              "quiet",
              "text-admin-accent hover:bg-admin-accent-soft hover:text-admin-accent",
            )}
          />
        </form>
      </div>
      ) : null}
    </section>
  );
}

/**
 * Fill against capacity, as a number and as a bar — the thing an admin scans a
 * card of heats for. Over capacity is the loud state: the timing system cannot
 * chip a lane that does not exist.
 *
 * The bar's width is the one inline style left in the builder, because a
 * percentage computed per heat is not something a class can express.
 */
function FillMeter({ fill, capacity }: { fill: number; capacity: number }) {
  const over = fill > capacity;
  const full = fill === capacity;
  const pct = capacity > 0 ? Math.min(100, Math.round((fill / capacity) * 100)) : 0;

  return (
    <div className="w-full sm:w-[190px]">
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-sans text-[20px] font-semibold normal-case not-italic leading-none tracking-[-0.02em] text-admin-ink">
          {fill}
          <span className="text-admin-muted">/{capacity}</span>
        </p>
        <p
          className={cn(
            "font-mono text-[10px] font-medium uppercase tracking-[0.14em]",
            over ? "text-admin-accent" : "text-admin-muted",
          )}
        >
          {over ? "over capacity" : full ? "full" : `${capacity - fill} free`}
        </p>
      </div>
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-pill bg-admin-surface-2">
        <div
          className={cn(
            "h-full rounded-pill",
            over ? "bg-admin-accent" : full ? "bg-admin-ok" : "bg-admin-ink-2",
          )}
          style={{ width: `${over ? 100 : pct}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Draft / published / finished, in the order the card moves through them. The
 * three read as three different things on purpose: draft is unreleased work,
 * published is live and emailed, finished has been run.
 *
 * A heat's state is exactly what `AdminPill` is for — a vocabulary that means
 * something inside the card it sits in, rather than one of the two panel-wide
 * ones (`EventStatusBadge`, `ParticipationBadge`).
 */
const HEAT_STATE_TONE: Record<HeatWithFill["state"], AdminPillTone> = {
  draft: "warn",
  published: "ok",
  finished: "muted",
};

function HeatStateBadge({ state }: { state: HeatWithFill["state"] }) {
  return (
    <AdminPill tone={HEAT_STATE_TONE[state]} dot>
      {state}
    </AdminPill>
  );
}

/** "Select shown" / "Clear shown" for one list. */
function SelectShown({
  rows,
  selected,
  onToggleAll,
}: {
  rows: SeedRow[];
  selected: Set<string>;
  onToggleAll: () => void;
}) {
  const allOn = rows.length > 0 && rows.every((r) => selected.has(r.id));
  return (
    <button
      type="button"
      className={adminButton("quiet", "h-7 text-[12px]")}
      onClick={onToggleAll}
      disabled={rows.length === 0}
    >
      {allOn ? "Clear shown" : `Select shown${rows.length > 0 ? ` (${rows.length})` : ""}`}
    </button>
  );
}

/**
 * Runners as a wrapping grid of selectable chips, so a full-width heat card shows
 * its whole field at once instead of hiding it in a narrow scroller. Only the
 * Unassigned list scrolls — a heat is capped at the bib pool, the pool is not.
 *
 * Selection is a border and a tinted ground, both class-driven, so a chip's state
 * is legible without reading its checkbox.
 */
function RunnerGrid({
  rows,
  selected,
  onToggle,
  emptyText,
  locale,
  slug,
  pool,
  canEdit,
  scroll = false,
  className,
}: {
  rows: SeedRow[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  emptyText: string;
  locale: string;
  slug: string;
  pool: number;
  canEdit: boolean;
  scroll?: boolean;
  className?: string;
}) {
  if (rows.length === 0) {
    return <p className={cn(ADMIN_NOTE, className)}>{emptyText}</p>;
  }

  return (
    <div
      className={cn(
        "grid grid-cols-[repeat(auto-fill,minmax(min(100%,200px),1fr))] gap-2",
        scroll && "admin-scroll max-h-[320px] overflow-y-auto pr-1",
        className,
      )}
    >
      {rows.map((r) => (
        <RunnerChip
          key={r.id}
          row={r}
          on={selected.has(r.id)}
          onToggle={onToggle}
          locale={locale}
          slug={slug}
          pool={pool}
          canEdit={canEdit}
        />
      ))}
    </div>
  );
}

/**
 * One runner: the selectable label on top, and the bib lease below it — a form
 * of its own, because chips sit outside every other form on the page and a
 * lease is a per-runner act, not part of the bulk selection. Submitting the
 * number leases it ahead of check-in; submitting it blank takes a
 * pre-assignment back. The container is a div rather than the old label so the
 * form's controls do not toggle the checkbox.
 *
 * Without `edit` both interactive halves fall away and the chip states the same
 * two facts flat: who this is, and which bib they hold.
 */
function RunnerChip({
  row,
  on,
  onToggle,
  locale,
  slug,
  pool,
  canEdit,
}: {
  row: SeedRow;
  on: boolean;
  onToggle: (id: string) => void;
  locale: string;
  slug: string;
  pool: number;
  canEdit: boolean;
}) {
  // Only `stale` is marked per runner: in a never-published heat *everyone* is
  // unnotified, so a dot on every chip would say nothing. A moved runner holding
  // an email that is now wrong is the case worth catching by eye — the count in
  // the card header covers the rest.
  const moved = row.notifyState === "stale" && row.status !== "no_show";

  return (
    <div
      data-admin-runner={row.id}
      data-selected={on ? "true" : "false"}
      className={cn(
        "rounded-admin border px-2.5 py-2 transition-colors",
        on
          ? "border-admin-accent bg-admin-accent-soft"
          : "border-admin-line bg-admin-surface-2 hover:border-admin-line-2",
      )}
    >
      <label className="flex cursor-pointer items-center gap-2.5">
        <input
          type="checkbox"
          checked={on}
          onChange={() => onToggle(row.id)}
          className="h-3.5 w-3.5 shrink-0 accent-admin-accent"
        />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate font-sans text-[13px] font-medium normal-case not-italic leading-tight text-admin-ink">
              {row.name}
            </span>
            {moved ? (
              <span
                title="Their heat or start time has moved since they were emailed"
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-admin-warn"
              />
            ) : null}
          </span>
          <span className="mt-1 block truncate text-[11.5px] leading-none text-admin-muted">
            {row.sex ?? "—"}
            {row.club ? ` · ${row.club}` : ""}
          </span>
        </span>
        {/* `confirmed` is the norm in this pool and says nothing; the other three
            are each a reason to look twice. */}
        {row.status === "confirmed" ? null : <ParticipationBadge status={row.status} />}
      </label>

      {canEdit ? (
        <form
          action={assignBib}
          className="mt-2 flex items-center gap-1.5 border-t border-admin-line/60 pt-2"
        >
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="registrationId" value={row.id} />
          <span className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-admin-muted">
            Bib
          </span>
          <input
            type="number"
            name="bib"
            min={1}
            max={pool}
            defaultValue={row.bib ?? ""}
            placeholder="—"
            className={adminInput("h-7 w-16 px-1.5 text-center text-[12px]")}
          />
          <button type="submit" className={adminButton("quiet", "h-7 px-2 text-[12px]")}>
            Set
          </button>
        </form>
      ) : (
        <p className="mt-2 flex items-center gap-1.5 border-t border-admin-line/60 pt-2 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-admin-muted">
          Bib
          <span className="text-[12px] tracking-normal text-admin-ink-2">{row.bib ?? "—"}</span>
        </p>
      )}
    </div>
  );
}
