import { useTranslations } from "next-intl";

import { formatTime } from "@/lib/events/time";
import type { EventSummary } from "@/lib/events/types";

/**
 * Results section — a combined leaderboard for a completed event, sorted by
 * time across all heats. Rendered directly below the hero when the latest
 * completed event has results.
 */
export function Results({ event }: { event: EventSummary }) {
  const t = useTranslations("landing.results");
  const results = event.results;
  if (!results) return null;

  const rows = results.heats
    .flatMap((heat) => heat.entries.map((entry) => ({ ...entry, heat: heat.number })))
    .sort((a, b) => a.timeCs - b.timeCs);

  return (
    <section className="section results" id="results" data-screen-label="Results">
      <div className="wrap">
        <div className="center stack" style={{ gap: 10 }}>
          <span className="results__eyebrow">{t("eyebrow")}</span>
          <h2 className="head t-sec">{t("title")}</h2>
          <p className="head t-20" style={{ opacity: 0.6 }}>
            {t("subtitle", {
              date: event.shortDate,
              count: rows.length,
              heats: results.heats.length,
            })}
          </p>
        </div>

        <div className="results__scroll">
          <table className="results__table">
            <thead>
              <tr>
                <th className="results__rank" scope="col">
                  {t("cols.place")}
                </th>
                <th scope="col">{t("cols.name")}</th>
                <th className="results__cat" scope="col">
                  {t("cols.category")}
                </th>
                <th className="results__cat" scope="col">
                  {t("cols.heat")}
                </th>
                <th className="results__time" scope="col">
                  {t("cols.time")}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={`${row.heat}-${row.bib}`} className={i < 3 ? "is-podium" : undefined}>
                  <td className="results__rank">{i + 1}</td>
                  <td className="results__name">{row.name}</td>
                  <td className="results__cat">{t(`category.${row.gender}`)}</td>
                  <td className="results__cat">{t("heatShort", { n: row.heat })}</td>
                  <td className="results__time">{formatTime(row.timeCs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
