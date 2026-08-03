"use client";

import { Fragment, useState } from "react";
import { useTranslations } from "next-intl";

import { computeLevel } from "@/lib/events/levels";
import { formatTime } from "@/lib/events/time";
import type { EventSummary } from "@/lib/events/types";

import { ChevronIcon } from "./icons";

/** The "all races" tab — deliberately not a valid event slug. */
const ALL = "all";

/**
 * Results section — leaderboards for every completed event, sorted by time
 * across all heats. Rendered directly below the hero when at least one
 * completed event has results.
 *
 * A tab row lets the visitor pick which race to see: "All" combines every
 * event into one leaderboard; each date tab shows that race alone. The tabs
 * only render when more than one event has results.
 *
 * Layout adapts to width without duplicating the data: it stays a single
 * `<table>`, but on narrow screens the detail columns (level / category)
 * collapse and each row gains an expand button that reveals them in a
 * stacked panel — so place, athlete, and time are always visible at a glance.
 */
export function Results({ events }: { events: EventSummary[] }) {
  const t = useTranslations("landing.results");
  const [selected, setSelected] = useState<string>(ALL);
  const [open, setOpen] = useState<string | null>(null);

  const withResults = events.filter((e) => e.results);
  if (withResults.length === 0) return null;

  const selectedEvent = withResults.find((e) => e.slug === selected) ?? null;
  const shownEvents = selectedEvent ? [selectedEvent] : withResults;

  const rows = shownEvents
    .flatMap((event) =>
      (event.results?.heats ?? []).flatMap((heat) =>
        heat.entries.map((entry) => ({
          ...entry,
          event,
          // Bibs are recycled leases (ADR 0003): only (event, heat, bib) is
          // unique, so the row id carries all three.
          id: `${event.slug}:${heat.number}:${entry.bib}`,
        })),
      ),
    )
    .sort((a, b) => a.timeCs - b.timeCs)
    .map((entry, i) => ({
      ...entry,
      rank: i + 1,
      level: computeLevel(entry.timeCs, entry.gender),
    }));

  const selectTab = (slug: string) => {
    setSelected(slug);
    setOpen(null);
  };

  return (
    <section className="section results" id="results" data-screen-label="Results">
      <div className="wrap">
        <div className="center stack" style={{ gap: 10 }}>
          <span className="results__eyebrow">{t("eyebrow")}</span>
          <h2 className="head t-sec">{t("title")}</h2>
          <p className="head t-20" style={{ opacity: 0.6 }}>
            {selectedEvent
              ? t("subtitle", { date: selectedEvent.shortDate, count: rows.length })
              : t("subtitleAll", { count: rows.length })}
          </p>
        </div>

        {withResults.length > 1 && (
          <div className="results__tabs" role="group" aria-label={t("tabsLabel")}>
            <button
              type="button"
              className="results__tab"
              aria-pressed={selected === ALL}
              onClick={() => selectTab(ALL)}
            >
              {t("tabs.all")}
            </button>
            {withResults.map((event) => (
              <button
                key={event.slug}
                type="button"
                className="results__tab"
                aria-pressed={selected === event.slug}
                onClick={() => selectTab(event.slug)}
              >
                {event.shortDate}
              </button>
            ))}
          </div>
        )}

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
                const isOpen = open === row.id;
                const podium = row.rank <= 3;
                return (
                  <Fragment key={row.id}>
                    <tr className={podium ? "is-podium" : undefined}>
                      <td className="results__rank">{row.rank}</td>
                      <td className="results__name">{row.name}</td>
                      <td className="results__lvl results__detail-col">
                        {t("level", { n: row.level })}
                      </td>
                      <td className="results__cat results__detail-col">
                        {t(`category.${row.gender}`)}
                      </td>
                      <td className="results__time">{formatTime(row.timeCs)}</td>
                      <td className="results__toggle-cell">
                        <button
                          type="button"
                          className="results__toggle"
                          aria-expanded={isOpen}
                          aria-controls={`results-detail-${row.id}`}
                          aria-label={t("detailsLabel")}
                          onClick={() => setOpen(isOpen ? null : row.id)}
                        >
                          <ChevronIcon className={isOpen ? "is-open" : undefined} />
                        </button>
                      </td>
                    </tr>
                    <tr
                      id={`results-detail-${row.id}`}
                      className={`results__detail-row${isOpen ? " is-open" : ""}`}
                    >
                      <td colSpan={6}>
                        <dl className="results__detail">
                          <div>
                            <dt>{t("cols.level")}</dt>
                            <dd>{t("level", { n: row.level })}</dd>
                          </div>
                          <div>
                            <dt>{t("cols.category")}</dt>
                            <dd>{t(`category.${row.gender}`)}</dd>
                          </div>
                          {!selectedEvent && (
                            <div>
                              <dt>{t("cols.race")}</dt>
                              <dd>{row.event.shortDate}</dd>
                            </div>
                          )}
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
