"use client";

import { useMemo, useState } from "react";

import { ConfirmSubmit } from "@/features/admin/components/confirm-submit";
import { StatusPill } from "@/features/admin/components/status-pill";
import {
  assignToHeat,
  deleteHeat,
  unassignFromHeat,
  updateHeat,
} from "@/features/admin/heat-actions";
import type { HeatWithFill, SeedRow } from "@/features/admin/heats-data";
import { formatHeatTime, instantToWarsawLocal } from "@/lib/events/heat-time";

const STATE_LABEL: Record<HeatWithFill["state"], string> = {
  draft: "draft",
  published: "published",
  finished: "finished",
};

/**
 * The heat card: one full-width row per heat showing its whole field at once,
 * under an Unassigned row of confirmed-but-unplaced runners. Rows rather than
 * columns because a heat holds up to a bib pool's worth of runners and names in a
 * narrow column are unreadable.
 *
 * The selection lives here as a `Set<registrationId>` (the recipient-multiselect
 * idiom) and is mirrored into hidden inputs on the bulk-move form, so one
 * selection spanning several rows can be moved in a single server action. The
 * runner checkboxes deliberately sit *outside* that form — nesting them inside it
 * would nest them inside the per-heat edit forms too, which HTML forbids.
 */
export function HeatBuilder({
  locale,
  slug,
  heats,
  seeds,
  pool,
}: {
  locale: string;
  slug: string;
  heats: HeatWithFill[];
  seeds: SeedRow[];
  pool: number;
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

  // The badge counts everyone unplaced, not just those surviving the filter —
  // the heat pills show true fill, and a count that shrank as you typed would
  // read as runners disappearing.
  const unassignedTotal = useMemo(() => seeds.filter((s) => !s.heatId).length, [seeds]);

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
      {/* ---- bulk move bar ---- */}
      <section className="iv-card">
        <div className="iv-section-head">
          <h2 className="iv-section-title">Seed runners</h2>
          <span className="iv-sub">{selected.size} selected</span>
        </div>

        <input
          type="text"
          className="iv-input"
          placeholder="Filter the lists by name, email or club…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ marginTop: 10 }}
        />

        {/* One form, two actions: `formAction` on the second button overrides the
            form's own, so a single selection can be moved or cleared. */}
        <form
          action={assignToHeat}
          className="iv-inline"
          style={{ marginTop: 12, alignItems: "flex-end", gap: 12 }}
        >
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="slug" value={slug} />
          {/* carries the selection into whichever action the button picks */}
          {[...selected].map((id) => (
            <input key={id} type="hidden" name="registrationIds" value={id} />
          ))}

          <label className="block">
            <span className="iv-fieldlabel">Move to</span>
            <select
              name="heatId"
              className="iv-input"
              defaultValue={heats[0]?.id ?? ""}
              disabled={heats.length === 0}
              style={{ minWidth: 220 }}
            >
              {heats.map((h) => (
                <option key={h.id} value={h.id}>
                  Heat {h.number} · {formatHeatTime(h.scheduledAt)} · {h.fill}/{h.capacity}
                </option>
              ))}
            </select>
          </label>

          <button
            type="submit"
            className="btn btn-red"
            disabled={selected.size === 0 || heats.length === 0}
          >
            Move {selected.size || ""} to heat
          </button>
          <button
            type="submit"
            formAction={unassignFromHeat}
            className="btn btn-stroke"
            disabled={selected.size === 0}
          >
            Unassign
          </button>
          <button
            type="button"
            className="iv-linkbtn"
            onClick={() => setSelected(new Set())}
            disabled={selected.size === 0}
          >
            Clear selection
          </button>
        </form>
      </section>

      {/* ---- one full-width row per heat, Unassigned first ---- */}
      <section className="iv-card" style={{ marginTop: 16 }}>
        <div className="iv-section-head">
          <div className="iv-inline" style={{ gap: 10, alignItems: "baseline" }}>
            <h3 className="iv-section-title">Unassigned</h3>
            <span className="iv-pill iv-pill--due">{unassignedTotal}</span>
            <span className="iv-note">confirmed runners not yet in a heat</span>
          </div>
          <SelectShown rows={unassigned} selected={selected} onToggleAll={() => toggleAll(unassigned)} />
        </div>
        <RunnerGrid
          rows={unassigned}
          selected={selected}
          onToggle={toggle}
          emptyText={query ? "No matches here." : "Everyone confirmed is placed."}
          scroll
        />
      </section>

      {heats.map((heat) => {
        const rows = byHeat.get(heat.id) ?? [];
        const over = heat.fill > heat.capacity;
        return (
          <section key={heat.id} className="iv-card" style={{ marginTop: 16 }}>
            <div className="iv-section-head">
              <div className="iv-inline" style={{ gap: 10, alignItems: "baseline" }}>
                <h3 className="iv-section-title">Heat {heat.number}</h3>
                <span className={`iv-pill ${over ? "iv-pill--red" : "iv-pill--ok"}`}>
                  {heat.fill}/{heat.capacity}
                </span>
                <span className="iv-note">
                  {formatHeatTime(heat.scheduledAt)} · {STATE_LABEL[heat.state]}
                  {over ? " · over capacity" : ""}
                </span>
                <SelectShown rows={rows} selected={selected} onToggleAll={() => toggleAll(rows)} />
              </div>

              {/* Edit and delete are sibling forms; the runner grid below sits
                  outside both, because nesting forms is illegal. */}
              <div className="iv-inline" style={{ alignItems: "flex-end", gap: 8 }}>
                <form action={updateHeat} className="iv-inline" style={{ alignItems: "flex-end", gap: 8 }}>
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="heatId" value={heat.id} />
                  <label className="block">
                    <span className="iv-fieldlabel">Start</span>
                    <input
                      className="iv-input"
                      type="datetime-local"
                      name="scheduledAt"
                      defaultValue={instantToWarsawLocal(heat.scheduledAt)}
                    />
                  </label>
                  <label className="block">
                    <span className="iv-fieldlabel">Cap.</span>
                    <input
                      className="iv-input"
                      type="number"
                      name="capacity"
                      min={1}
                      max={pool}
                      defaultValue={heat.capacity}
                      style={{ width: 78 }}
                    />
                  </label>
                  <button type="submit" className="btn btn-stroke btn-sm">
                    Save
                  </button>
                </form>
                <form action={deleteHeat}>
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="heatId" value={heat.id} />
                  <ConfirmSubmit
                    label="Delete"
                    title={`Delete heat ${heat.number}?`}
                    message="Its runners go back to Unassigned. Registrations are not deleted, and the remaining heats keep their numbers."
                    confirmLabel="Delete heat"
                  />
                </form>
              </div>
            </div>

            <RunnerGrid
              rows={rows}
              selected={selected}
              onToggle={toggle}
              emptyText={query ? "No matches in this heat." : "Empty — select runners above and move them in."}
            />
          </section>
        );
      })}
    </>
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
    <button type="button" className="iv-linkbtn" onClick={onToggleAll} disabled={rows.length === 0}>
      {allOn ? "Clear shown" : "Select shown"}
    </button>
  );
}

/**
 * Runners as a wrapping grid of selectable cards, so a full-width heat row shows
 * its whole field at once instead of hiding it in a narrow scroller. Only the
 * Unassigned list scrolls — a heat is capped at the bib pool, the pool is not.
 */
function RunnerGrid({
  rows,
  selected,
  onToggle,
  emptyText,
  scroll = false,
}: {
  rows: SeedRow[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  emptyText: string;
  scroll?: boolean;
}) {
  if (rows.length === 0) {
    return <p className="iv-note">{emptyText}</p>;
  }

  return (
    <div
      style={{
        display: "grid",
        gap: 8,
        gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
        ...(scroll ? { maxHeight: 320, overflowY: "auto" as const, paddingRight: 4 } : {}),
      }}
    >
      {rows.map((r) => {
        const on = selected.has(r.id);
        return (
          <label
            key={r.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 10px",
              borderRadius: 8,
              cursor: "pointer",
              border: `1px solid ${on ? "rgba(255,255,255,.34)" : "rgba(255,255,255,.12)"}`,
              background: on ? "rgba(255,255,255,.08)" : "transparent",
            }}
          >
            <input type="checkbox" checked={on} onChange={() => onToggle(r.id)} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span
                style={{
                  display: "block",
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {r.name}
              </span>
              <span
                style={{
                  display: "block",
                  fontSize: 12,
                  opacity: 0.7,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {r.sex ?? "—"}
                {r.club ? ` · ${r.club}` : ""}
              </span>
            </span>
            {r.status === "confirmed" ? null : <StatusPill status={r.status} />}
          </label>
        );
      })}
    </div>
  );
}

