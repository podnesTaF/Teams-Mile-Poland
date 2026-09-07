"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

export interface AdminSubmissionRow {
  id: string;
  receivedAtLabel: string;
  participantName: string;
  eventLabel: string;
  docTitle: string;
  localeShort: string;
  agreedCount: number;
  agreedTotal: number;
}

/**
 * Interaktywna tabela zgłoszeń z checkboxami do zaznaczania wielu
 * wierszy naraz i zbiorczym przyciskiem "Drukuj wybrane", który
 * przenosi do /admin/submissions/print?ids=... (patrz ta strona —
 * drukuje wszystkie zaznaczone zgłoszenia jedno po drugim, każde na
 * osobnej stronie wydruku).
 */
export function AdminSubmissionsTable({ rows }: { rows: AdminSubmissionRow[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const allSelected = rows.length > 0 && selected.size === rows.length;
  const someSelected = selected.size > 0 && !allSelected;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const printHref = useMemo(
    () => `/admin/submissions/print?ids=${Array.from(selected).join(",")}`,
    [selected],
  );

  return (
    <div>
      {selected.size > 0 && (
        <div className="sticky top-16 z-30 mb-4 flex items-center justify-between rounded-xl border border-brand-accent/40 bg-brand-accentSoft px-4 py-3">
          <span className="text-sm font-semibold text-brand-accent">
            Zaznaczono: {selected.size}
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="text-xs font-semibold text-brand-textMuted underline decoration-dotted underline-offset-4 hover:text-brand-text"
            >
              Wyczyść zaznaczenie
            </button>
            <Link href={printHref} className="btn-primary py-2 text-xs">
              🖨 Drukuj wybrane ({selected.size})
            </Link>
          </div>
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-brand-border text-xs uppercase tracking-wide text-brand-textMuted">
            <tr>
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={toggleAll}
                  aria-label="Zaznacz wszystkie"
                  className="h-4 w-4 accent-brand-accent"
                />
              </th>
              <th className="px-4 py-3">Data i godzina</th>
              <th className="px-4 py-3">Uczestnik</th>
              <th className="px-4 py-3">Wydarzenie</th>
              <th className="px-4 py-3">Dokument</th>
              <th className="px-4 py-3">Język</th>
              <th className="px-4 py-3">Zgody</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className={`border-b border-brand-border/60 last:border-0 hover:bg-white/[0.03] ${
                  selected.has(row.id) ? "bg-brand-accentSoft/40" : ""
                }`}
              >
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected.has(row.id)}
                    onChange={() => toggleOne(row.id)}
                    aria-label={`Zaznacz zgłoszenie ${row.participantName}`}
                    className="h-4 w-4 accent-brand-accent"
                  />
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-brand-textMuted">
                  {row.receivedAtLabel}
                </td>
                <td className="px-4 py-3 font-semibold">{row.participantName}</td>
                <td className="px-4 py-3 text-brand-textMuted">{row.eventLabel}</td>
                <td className="px-4 py-3">{row.docTitle}</td>
                <td className="px-4 py-3">
                  <span className="rounded-pill border border-brand-border px-2 py-0.5 text-xs font-bold uppercase">
                    {row.localeShort}
                  </span>
                </td>
                <td className="px-4 py-3 text-brand-textMuted">
                  {row.agreedCount}/{row.agreedTotal}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <Link
                    href={`/admin/submissions/${row.id}`}
                    className="text-sm font-semibold text-brand-accent underline decoration-dotted underline-offset-4"
                  >
                    Zobacz i drukuj →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
