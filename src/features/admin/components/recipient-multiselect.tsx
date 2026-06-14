"use client";

import { useMemo, useState } from "react";

export type RegistrationOption = {
  id: string;
  fullName: string;
  email: string;
  registrationType: string;
  teamName: string | null;
};

const TYPE_LABEL: Record<string, string> = {
  captain: "Captain",
  team_member: "Team member",
  free_agent: "Free agent",
  solo: "Solo",
};

/**
 * Searchable checkbox list of every registered runner. Selected ids are mirrored
 * into hidden `runnerIds` inputs so the surrounding `<form action={…}>` server
 * action receives them via `formData.getAll("runnerIds")`.
 */
export function RecipientMultiselect({ options }: { options: RegistrationOption[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.fullName.toLowerCase().includes(q) ||
        o.email.toLowerCase().includes(q) ||
        (o.teamName?.toLowerCase().includes(q) ?? false),
    );
  }, [options, query]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allFilteredSelected = filtered.length > 0 && filtered.every((o) => selected.has(o.id));

  function toggleAllFiltered() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) filtered.forEach((o) => next.delete(o.id));
      else filtered.forEach((o) => next.add(o.id));
      return next;
    });
  }

  return (
    <div>
      {/* carries the selection into the server action */}
      {[...selected].map((id) => (
        <input key={id} type="hidden" name="runnerIds" value={id} />
      ))}

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
        <input
          type="text"
          className="iv-input"
          placeholder="Search name, email or team…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ flex: 1 }}
        />
        <button
          type="button"
          className="btn btn-stroke btn-sm"
          onClick={toggleAllFiltered}
          disabled={filtered.length === 0}
        >
          {allFilteredSelected ? "Clear shown" : "Select shown"}
        </button>
      </div>

      <div
        style={{
          maxHeight: 280,
          overflowY: "auto",
          border: "1px solid rgba(255,255,255,.12)",
          borderRadius: 8,
        }}
      >
        {options.length === 0 ? (
          <p className="iv-note" style={{ padding: "12px 14px", margin: 0 }}>
            No registrations yet.
          </p>
        ) : filtered.length === 0 ? (
          <p className="iv-note" style={{ padding: "12px 14px", margin: 0 }}>
            No registrants match “{query}”.
          </p>
        ) : (
          filtered.map((o) => (
            <label
              key={o.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 12px",
                borderBottom: "1px solid rgba(255,255,255,.06)",
                cursor: "pointer",
              }}
            >
              <input type="checkbox" checked={selected.has(o.id)} onChange={() => toggle(o.id)} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontWeight: 600 }}>{o.fullName}</span>
                <span style={{ display: "block", fontSize: 12, opacity: 0.7 }}>
                  {o.email}
                  {o.teamName ? ` · ${o.teamName}` : ""}
                </span>
              </span>
              <span style={{ fontSize: 11, opacity: 0.7, whiteSpace: "nowrap" }}>
                {TYPE_LABEL[o.registrationType] ?? o.registrationType}
              </span>
            </label>
          ))
        )}
      </div>

      <p className="iv-note" style={{ marginTop: 8 }}>
        {selected.size} selected · {options.length} registered
      </p>
    </div>
  );
}
