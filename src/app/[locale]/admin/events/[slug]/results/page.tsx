import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { requireAdmin } from "@/features/admin/action-helpers";
import { AdminFlash } from "@/features/admin/components/admin-flash";
import { ResultsImportPanel } from "@/features/admin/components/results-import-panel";
import { ADMIN_NOTE, ADMIN_TITLE, adminCard } from "@/features/admin/components/shell/admin-card";
import { AdminStat } from "@/features/admin/components/shell/admin-stat";
import {
  getImportedResults,
  getResultsState,
  type ImportedResultRow,
} from "@/features/admin/results-import/data";
import { getEventBySlug } from "@/lib/events/registry";
import { formatTime } from "@/lib/events/time";
import { cn } from "@/lib/utils";

type PageProps = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ ok?: string; error?: string; rows?: string; heats?: string; skipped?: string }>;
};

/** Warsaw-local stamp for the per-heat "imported at" column. */
const DATETIME_FMT = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Warsaw",
  dateStyle: "medium",
  timeStyle: "short",
});

const HEAD_CELL =
  "px-3 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-admin-muted";
const CELL = "px-3 py-2 align-middle text-[13px] text-admin-ink-2";

/** Non-finisher rows show their status where a finisher shows a place. */
const STATUS_LABEL = { dnf: "DNF", dns: "DNS", dsq: "DSQ" } as const;

/**
 * The Results tab: what the timing system has reported for this event, and the
 * import that gets it there (timing integration slice). The event chrome comes
 * from the layout; this page is only the imported-state table and the upload.
 */
export default async function AdminEventResultsPage({ params, searchParams }: PageProps) {
  const { locale, slug } = await params;
  const query = await searchParams;
  setRequestLocale(locale);
  await requireAdmin(locale);

  const event = getEventBySlug(slug);
  if (!event || event.eventType !== "individual") notFound();

  const [state, importedRows] = await Promise.all([
    getResultsState(slug),
    getImportedResults(slug),
  ]);
  const totalRows = state.reduce((sum, h) => sum + h.rows, 0);
  const totalLinked = state.reduce((sum, h) => sum + h.linked, 0);
  const totalFinishers = state.reduce((sum, h) => sum + h.finishers, 0);

  // Rows arrive pre-sorted (heat asc, finishers by place, then DNF/DSQ/DNS);
  // grouping preserves that order per heat.
  const rowsByHeat = new Map<number, ImportedResultRow[]>();
  for (const row of importedRows) {
    const list = rowsByHeat.get(row.heatNumber);
    if (list) list.push(row);
    else rowsByHeat.set(row.heatNumber, [row]);
  }

  return (
    <>
      <AdminFlash query={query} context={{ slug }} />

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <AdminStat label="Heats imported" value={state.length} />
        <AdminStat label="Results" value={totalRows} />
        <AdminStat label="Finishers" value={totalFinishers} />
        <AdminStat label="Linked to runner" value={totalLinked} />
      </div>

      <div className="mt-4">
        <ResultsImportPanel locale={locale} slug={slug} />
      </div>

      {state.length > 0 ? (
        <section className={adminCard("mt-4 p-4 sm:p-5")}>
          <h2 className={ADMIN_TITLE}>Imported heats</h2>
          <p className={cn(ADMIN_NOTE, "mt-1.5 max-w-[78ch]")}>
            Each import replaces whole heats, so a heat&apos;s row here always reflects its latest
            file. Unlinked results are shown publicly but do not appear on any runner&apos;s
            profile until they match.
          </p>
          <div className="admin-scroll mt-3 overflow-x-auto rounded-admin-lg border border-admin-line">
            <table className="w-full border-collapse text-left" data-results-state-table>
              <thead className="border-b border-admin-line bg-admin-surface-2">
                <tr>
                  <th scope="col" className={HEAD_CELL}>
                    Heat
                  </th>
                  <th scope="col" className={HEAD_CELL}>
                    Results
                  </th>
                  <th scope="col" className={HEAD_CELL}>
                    Finishers
                  </th>
                  <th scope="col" className={HEAD_CELL}>
                    Linked
                  </th>
                  <th scope="col" className={HEAD_CELL}>
                    Imported
                  </th>
                </tr>
              </thead>
              <tbody>
                {state.map((heat) => (
                  <tr
                    key={heat.heatNumber}
                    className="border-b border-admin-line/60 last:border-b-0"
                  >
                    <td className={cn(CELL, "text-admin-ink")}>Heat {heat.heatNumber}</td>
                    <td className={CELL}>{heat.rows}</td>
                    <td className={CELL}>{heat.finishers}</td>
                    <td className={CELL}>
                      {heat.linked}
                      {heat.linked < heat.rows ? ` of ${heat.rows}` : ""}
                    </td>
                    <td className={CELL}>{DATETIME_FMT.format(heat.importedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <p className={cn(ADMIN_NOTE, "mt-4")} data-results-empty>
          Nothing imported yet
          {event.results
            ? " — the public site is showing this event's hand-entered config sheet until an import replaces it."
            : "."}
        </p>
      )}

      {importedRows.length > 0 ? (
        <section className={adminCard("mt-4 p-4 sm:p-5")}>
          <h2 className={ADMIN_TITLE}>Imported results</h2>
          <p className={cn(ADMIN_NOTE, "mt-1.5 max-w-[78ch]")}>
            Every row as the timing system reported it. &ldquo;Linked to&rdquo; is the runner
            account the row was resolved to at import time — a dash means the row is shown
            publicly but appears on no profile.
          </p>
          {[...rowsByHeat.entries()].map(([heatNumber, rows]) => (
            <div key={heatNumber} className="mt-4">
              <h3 className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-admin-muted">
                Heat {heatNumber}
              </h3>
              <div className="admin-scroll mt-2 overflow-x-auto rounded-admin-lg border border-admin-line">
                <table className="w-full border-collapse text-left" data-results-rows-table>
                  <thead className="border-b border-admin-line bg-admin-surface-2">
                    <tr>
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
                        Gender
                      </th>
                      <th scope="col" className={HEAD_CELL}>
                        Time
                      </th>
                      <th scope="col" className={HEAD_CELL}>
                        Linked to
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr
                        key={`${row.heatNumber}:${row.bib}`}
                        className="border-b border-admin-line/60 last:border-b-0"
                      >
                        <td className={cn(CELL, "text-admin-ink")}>
                          {row.status === "finished" ? row.place : STATUS_LABEL[row.status]}
                        </td>
                        <td className={CELL}>{row.bib}</td>
                        <td className={cn(CELL, "text-admin-ink")}>{row.name}</td>
                        <td className={CELL}>{row.gender}</td>
                        <td className={cn(CELL, "font-mono tabular-nums")}>
                          {row.timeCs !== null ? formatTime(row.timeCs) : "—"}
                        </td>
                        <td className={CELL}>{row.linkedTo ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </section>
      ) : null}
    </>
  );
}
