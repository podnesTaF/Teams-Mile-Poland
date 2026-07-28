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
import { formatHeatTime, instantToWarsawLocal } from "@/features/admin/heat-time";
import type { HeatWithFill, SeedRow } from "@/features/admin/heats-data";

const STATE_LABEL: Record<HeatWithFill["state"], string> = {
  draft: "draft",
  published: "published",
  finished: "finished",
};

/**
 * The heat card: every heat with its seeded runners, plus an Unassigned column of
 * confirmed-but-unplaced runners.
 *
 * The selection lives here as a `Set<registrationId>` (the recipient-multiselect
 * idiom) and is mirrored into hidden inputs on the bulk-move form, so one
 * selection spanning several columns can be moved in a single server action. The
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

      {/* ---- unassigned + heat columns ---- */}
      <div
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          marginTop: 16,
        }}
      >
        <section className="iv-card">
          <div className="iv-section-head">
            <h3 className="iv-section-title">Unassigned</h3>
            <span className="iv-pill iv-pill--due">{unassignedTotal}</span>
          </div>
          <p className="iv-note" style={{ marginTop: 4 }}>
            Confirmed runners not yet in a heat.
          </p>
          <RunnerList
            rows={unassigned}
            selected={selected}
            onToggle={toggle}
            onToggleAll={() => toggleAll(unassigned)}
            emptyText={query ? "No matches here." : "Everyone confirmed is placed."}
          />
        </section>

        {heats.map((heat) => {
          const rows = byHeat.get(heat.id) ?? [];
          const over = heat.fill > heat.capacity;
          return (
            <section key={heat.id} className="iv-card">
              <div className="iv-section-head">
                <h3 className="iv-section-title">Heat {heat.number}</h3>
                <span className={`iv-pill ${over ? "iv-pill--red" : "iv-pill--ok"}`}>
                  {heat.fill}/{heat.capacity}
                </span>
              </div>
              <p className="iv-note" style={{ marginTop: 4 }}>
                {formatHeatTime(heat.scheduledAt)} · {STATE_LABEL[heat.state]}
                {over ? " · over capacity" : ""}
              </p>

              <form action={updateHeat} style={{ marginTop: 10 }}>
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="heatId" value={heat.id} />
                <div className="iv-inline" style={{ alignItems: "flex-end", gap: 8 }}>
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
                      style={{ width: 80 }}
                    />
                  </label>
                  <button type="submit" className="btn btn-stroke btn-sm">
                    Save
                  </button>
                </div>
              </form>

              <RunnerList
                rows={rows}
                selected={selected}
                onToggle={toggle}
                onToggleAll={() => toggleAll(rows)}
                emptyText={query ? "No matches in this heat." : "Empty — move runners in."}
              />

              <form action={deleteHeat} style={{ marginTop: 10 }}>
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="heatId" value={heat.id} />
                <ConfirmSubmit
                  label="Delete heat"
                  title={`Delete heat ${heat.number}?`}
                  message="Its runners go back to Unassigned. Registrations are not deleted, and the remaining heats keep their numbers."
                  confirmLabel="Delete heat"
                />
              </form>
            </section>
          );
        })}
      </div>
    </>
  );
}

function RunnerList({
  rows,
  selected,
  onToggle,
  onToggleAll,
  emptyText,
}: {
  rows: SeedRow[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  emptyText: string;
}) {
  const allOn = rows.length > 0 && rows.every((r) => selected.has(r.id));

  return (
    <div style={{ marginTop: 10 }}>
      <button
        type="button"
        className="iv-linkbtn"
        onClick={onToggleAll}
        disabled={rows.length === 0}
      >
        {allOn ? "Clear shown" : "Select shown"}
      </button>

      <div
        style={{
          marginTop: 6,
          maxHeight: 300,
          overflowY: "auto",
          border: "1px solid rgba(255,255,255,.12)",
          borderRadius: 8,
        }}
      >
        {rows.length === 0 ? (
          <p className="iv-note" style={{ padding: "10px 12px", margin: 0 }}>
            {emptyText}
          </p>
        ) : (
          rows.map((r) => (
            <label
              key={r.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 12px",
                borderBottom: "1px solid rgba(255,255,255,.06)",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={selected.has(r.id)}
                onChange={() => onToggle(r.id)}
              />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontWeight: 600 }}>{r.name}</span>
                <span style={{ display: "block", fontSize: 12, opacity: 0.7 }}>
                  {r.sex ?? "—"}
                  {r.club ? ` · ${r.club}` : ""}
                </span>
              </span>
              {r.status === "confirmed" ? null : <StatusPill status={r.status} />}
            </label>
          ))
        )}
      </div>
    </div>
  );
}
