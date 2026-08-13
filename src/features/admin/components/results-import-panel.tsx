"use client";

import { useRef, useState, useTransition } from "react";

import {
  commitResultsImport,
  previewResultsImport,
  type ImportPreview,
} from "@/features/admin/results-actions";
import { cn } from "@/lib/utils";

import { ConfirmSubmit } from "./confirm-submit";
import { adminButton } from "./shell/admin-button";
import { ADMIN_NOTE, ADMIN_TITLE, adminCard } from "./shell/admin-card";
import { AdminNotice } from "./shell/admin-notice";

/**
 * The results-import panel: choose the timing export, preview what it parses
 * to, then commit. Preview and commit send the same file through the same
 * server-side parse, so what was inspected is what is imported; picking a
 * different file clears the stale preview.
 *
 * Committing replaces every heat present in the file — the confirm dialog says
 * which — so a corrected file is safe to re-import and a mid-event import can
 * arrive heat by heat.
 */

const HEAD_CELL =
  "px-3 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-admin-muted";
const CELL = "px-3 py-2 align-middle text-[13px] text-admin-ink-2";

/** How the row found its runner, as the preview badges it. */
// Exhaustive over PreviewRow["matchedBy"] (with null spelt "none") — a new
// match source must add its label here or fail to compile, not throw at render.
const MATCH_LABEL: Record<"lease" | "name" | "none", { text: string; className: string }> = {
  lease: { text: "bib lease", className: "text-admin-ok" },
  name: { text: "name", className: "text-admin-ok" },
  none: { text: "unlinked", className: "text-admin-warn" },
};

export function ResultsImportPanel({ locale, slug }: { locale: string; slug: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [pending, startTransition] = useTransition();

  const runPreview = () => {
    const form = formRef.current;
    if (!form) return;
    const formData = new FormData(form);
    startTransition(async () => {
      setPreview(await previewResultsImport(slug, formData));
    });
  };

  const ready = preview?.ok === true;
  const skipped = preview && preview.ok ? preview.errors.length : 0;

  return (
    <section className={adminCard("p-4 sm:p-5")}>
      <h2 className={ADMIN_TITLE}>Import timing results</h2>
      <p className={cn(ADMIN_NOTE, "mt-1.5 max-w-[78ch]")}>
        Upload the RaceResult export (.xlsx or .csv). The file must carry a heat column — bibs are
        recycled between heats, so a bib alone does not identify a result. Preview first; importing
        replaces every heat present in the file, so a corrected file is safe to re-import.
      </p>

      <form ref={formRef} action={commitResultsImport.bind(null, slug)} className="mt-4">
        <input type="hidden" name="locale" value={locale} />
        <div className="flex flex-wrap items-center gap-2.5">
          <input
            type="file"
            name="file"
            accept=".csv,.xlsx"
            onChange={() => setPreview(null)}
            className="text-[13px] text-admin-ink-2 file:mr-3 file:cursor-pointer file:rounded-admin file:border file:border-admin-line file:bg-admin-surface-2 file:px-3 file:py-1.5 file:text-[12px] file:font-medium file:text-admin-ink"
            data-results-file
          />
          <button
            type="button"
            className={adminButton()}
            onClick={runPreview}
            disabled={pending}
            data-results-preview
          >
            {pending ? "Reading…" : "Preview"}
          </button>
          {ready ? (
            <ConfirmSubmit
              label="Import"
              title={`Replace ${preview.heats === 1 ? "1 heat" : `${preview.heats} heats`}?`}
              message={
                `${preview.rows.length} rows will be written; any results already imported for ` +
                `these heats are replaced. Heats not in the file are left alone.` +
                (skipped > 0 ? ` ${skipped} unreadable rows will be skipped.` : "")
              }
              confirmLabel="Import"
              danger={false}
              triggerClassName={adminButton("primary")}
            />
          ) : null}
        </div>
      </form>

      {preview && !preview.ok ? (
        <AdminNotice className="mt-4">
          {preview.errors.map((e) => (
            <div key={`${e.sourceRow}:${e.message}`}>
              {e.sourceRow > 0 ? `Row ${e.sourceRow}: ` : ""}
              {e.message}
            </div>
          ))}
        </AdminNotice>
      ) : null}

      {preview?.ok ? (
        <div className="mt-4">
          <p className={ADMIN_NOTE} data-results-preview-summary>
            {preview.rows.length} rows across {preview.heats}{" "}
            {preview.heats === 1 ? "heat" : "heats"} · {preview.linked} linked to a registration ·{" "}
            {preview.rows.length - preview.linked} unlinked
            {skipped > 0 ? ` · ${skipped} unreadable rows skipped` : ""}
          </p>

          {preview.unknownHeats.length > 0 ? (
            <AdminNotice className="mt-3">
              Heat {preview.unknownHeats.join(", ")} does not exist on this event&apos;s card —
              check for a typo in the file before importing.
            </AdminNotice>
          ) : null}

          {skipped > 0 ? (
            <AdminNotice className="mt-3" tone="info">
              {preview.errors.map((e) => (
                <div key={`${e.sourceRow}:${e.message}`}>
                  Row {e.sourceRow}: {e.message} — this row will not be imported.
                </div>
              ))}
            </AdminNotice>
          ) : null}

          <div className="admin-scroll mt-3 overflow-x-auto rounded-admin-lg border border-admin-line">
            <table className="w-full border-collapse text-left" data-results-preview-table>
              <thead className="border-b border-admin-line bg-admin-surface-2">
                <tr>
                  <th scope="col" className={HEAD_CELL}>
                    Heat
                  </th>
                  <th scope="col" className={HEAD_CELL}>
                    Place
                  </th>
                  <th scope="col" className={HEAD_CELL}>
                    Bib
                  </th>
                  <th scope="col" className={HEAD_CELL}>
                    Name
                  </th>
                  <th scope="col" className={HEAD_CELL}>
                    Sex
                  </th>
                  <th scope="col" className={HEAD_CELL}>
                    Time
                  </th>
                  <th scope="col" className={HEAD_CELL}>
                    Status
                  </th>
                  <th scope="col" className={HEAD_CELL}>
                    Runner match
                  </th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row) => {
                  const match = MATCH_LABEL[row.matchedBy ?? "none"];
                  return (
                    <tr
                      key={`${row.heat}:${row.bib}`}
                      className="border-b border-admin-line/60 last:border-b-0"
                    >
                      <td className={CELL}>{row.heat}</td>
                      <td className={CELL}>{row.place ?? "—"}</td>
                      <td className={CELL}>{row.bib}</td>
                      <td className={cn(CELL, "text-admin-ink")}>{row.name}</td>
                      <td className={CELL}>{row.gender}</td>
                      <td className={cn(CELL, "font-mono text-[12px]")}>{row.time}</td>
                      <td className={CELL}>{row.status}</td>
                      <td className={cn(CELL, "font-mono text-[10px] uppercase tracking-[0.14em]")}>
                        <span className={match.className}>{match.text}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}
