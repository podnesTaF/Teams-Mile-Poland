"use client";

import { Fragment, useState } from "react";
import { useTranslations } from "next-intl";

import { computeLevel } from "@/lib/events/levels";
import { formatTime } from "@/lib/events/time";
import type { EventSummary } from "@/lib/events/types";

import { ChevronIcon } from "./icons";

/**
 * Results section — a combined leaderboard for a completed event, sorted by
 * time across all heats. Rendered directly below the hero when the latest
 * completed event has results.
 *
 * Layout adapts to width without duplicating the data: it stays a single
 * `<table>`, but on narrow screens the detail columns (level / category /
 * heat) collapse and each row gains an expand button that reveals them in a
 * stacked panel — so place, athlete, and time are always visible at a glance.
 */
export function Results({ event }: { event: EventSummary }) {
  const t = useTranslations("landing.results");
  const [open, setOpen] = useState<string | null>(null);
  const results = event.results;
  if (!results) return null;

  const rows = results.heats
    .flatMap((heat) => heat.entries.map((entry) => ({ ...entry, heat: heat.number })))
    .sort((a, b) => a.timeCs - b.timeCs)
    .map((entry, i) => ({
      ...entry,
      rank: i + 1,
      level: computeLevel(entry.timeCs, entry.gender),
    }));

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
                <th className="results__lvl results__detail-col" scope="col">
                  {t("cols.level")}
                </th>
                <th className="results__cat results__detail-col" scope="col">
                  {t("cols.category")}
                </th>
                <th className="results__cat results__detail-col" scope="col">
                  {t("cols.heat")}
                </th>
                <th className="results__time" scope="col">
                  {t("cols.time")}
                </th>
                <th className="results__toggle-col">
                  <span className="sr-only">{t("detailsLabel")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const id = `${row.heat}-${row.bib}`;
                const isOpen = open === id;
                const podium = row.rank <= 3;
                return (
                  <Fragment key={id}>
                    <tr className={podium ? "is-podium" : undefined}>
                      <td className="results__rank">{row.rank}</td>
                      <td className="results__name">{row.name}</td>
                      <td className="results__lvl results__detail-col">
                        {t("level", { n: row.level })}
                      </td>
                      <td className="results__cat results__detail-col">
                        {t(`category.${row.gender}`)}
                      </td>
                      <td className="results__cat results__detail-col">
                        {t("heatShort", { n: row.heat })}
                      </td>
                      <td className="results__time">{formatTime(row.timeCs)}</td>
                      <td className="results__toggle-cell">
                        <button
                          type="button"
                          className="results__toggle"
                          aria-expanded={isOpen}
                          aria-controls={`results-detail-${id}`}
                          aria-label={t("detailsLabel")}
                          onClick={() => setOpen(isOpen ? null : id)}
                        >
                          <ChevronIcon className={isOpen ? "is-open" : undefined} />
                        </button>
                      </td>
                    </tr>
                    <tr
                      id={`results-detail-${id}`}
                      className={`results__detail-row${isOpen ? " is-open" : ""}`}
                    >
                      <td colSpan={7}>
                        <dl className="results__detail">
                          <div>
                            <dt>{t("cols.level")}</dt>
                            <dd>{t("level", { n: row.level })}</dd>
                          </div>
                          <div>
                            <dt>{t("cols.category")}</dt>
                            <dd>{t(`category.${row.gender}`)}</dd>
                          </div>
                          <div>
                            <dt>{t("cols.heat")}</dt>
                            <dd>{t("heatShort", { n: row.heat })}</dd>
                          </div>
                        </dl>
                      </td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
