import { getTranslations } from "next-intl/server";

import type { PublicEventResults } from "@/lib/events/results-data";
import { formatTime } from "@/lib/events/time";

/**
 * The per-heat results tables — one `.sl-heat` card per heat, finishers in
 * place order then DNF/DSQ/DNS, plus the status legend. Shared by the
 * per-event results page (`/events/[slug]/results`, fresh on every request for
 * mid-event imports) and the completed event detail page, which inlines the
 * same tables as its archive view — extracted so the two surfaces cannot
 * drift.
 *
 * Styling comes from `heats/heats.css` (`.sl-heats`, `.iv-table`) — the
 * rendering page imports it and provides the `.iv` root.
 */
export async function ResultsTables({ results }: { results: PublicEventResults }) {
  const t = await getTranslations("events");

  return (
    <>
      <div className="sl-heats">
        {results.heats.map((heat) => {
          const finishers = heat.rows.filter((r) => r.status === "finished").length;
          return (
            <article className="sl-heat" key={heat.number} data-results-heat={heat.number}>
              <header className="sl-heat__head">
                <h2 className="sl-heat__no">{t("results.heat", { number: heat.number })}</h2>
                <span className="sl-heat__count">
                  {t("results.finishers", { count: finishers })}
                </span>
              </header>
              <div className="iv-tablewrap">
                <table className="iv-table sl-table">
                  <thead>
                    <tr>
                      <th>{t("results.colPlace")}</th>
                      <th>{t("results.colName")}</th>
                      <th>{t("results.colTime")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {heat.rows.map((row) => (
                      // Bibs are per-heat leases (ADR 0003): within one heat
                      // the bib alone is unique.
                      <tr key={row.bib}>
                        <td>{row.place ?? "—"}</td>
                        <td className="sl-table__name">{row.name}</td>
                        <td className={row.status === "finished" ? undefined : "sl-table__club"}>
                          {row.timeCs !== null && row.status === "finished"
                            ? formatTime(row.timeCs)
                            : row.status.toUpperCase()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          );
        })}
      </div>
      <p className="iv-meta sl-approx">{t("results.legend")}</p>
    </>
  );
}
