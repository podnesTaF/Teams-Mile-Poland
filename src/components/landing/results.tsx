"use client";

import { Fragment, useState } from "react";
import { useTranslations } from "next-intl";

import { buildLeaderboard } from "@/lib/events/leaderboard";
import { computeLevel } from "@/lib/events/levels";
import { formatTime } from "@/lib/events/time";
import type { EventSummary } from "@/lib/events/types";

import { ChevronIcon } from "./icons";

/** The "all races" tab — deliberately not a valid event slug. */
const ALL = "all";

/**
 * Results section — the series standings plus a leaderboard per completed
 * event. Rendered directly below the hero when at least one completed event has
 * results.
 *
 * A tab row lets the visitor pick what to see: "All" is the person-level board
 * — every runner once, ranked by their best mile of the series (see
 * `lib/events/leaderboard.ts`); each date tab ranks that race's rows on their
 * own. The tabs only render when more than one event has results.
 *
 * Layout adapts to width without duplicating the data: it stays a single
 * `<table>`, but on narrow screens the detail columns (level / category /
 * races) collapse and each row gains an expand button that reveals them in a
 * stacked panel — so place, athlete, and time are always visible at a glance.
 */
export function Results({ events }: { events: EventSummary[] }) {
  const t = useTranslations("landing.results");
  const [selected, setSelected] = useState<string>(ALL);
  const [open, setOpen] = useState<string | null>(null);

  const withResults = events.filter((e) => e.results);
  if (withResults.length === 0) return null;

  const selectedEvent = withResults.find((e) => e.slug === selected) ?? null;

  // Per-event tab: that race's own rows, ranked by time across its heats.
  const eventRows = (selectedEvent ? [selectedEvent] : [])
    .flatMap((event) =>
      (event.results?.heats ?? []).flatMap((heat) =>
        heat.entries.map((entry) => ({
          ...entry,
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

  // "All" tab: one row per person, not per result. Genders share the list, as
  // they always have here — the level column is what reads them apart, being
  // computed against gender-specific bars.
  const personRows = selectedEvent ? [] : buildLeaderboard(withResults);

  const count = selectedEvent ? eventRows.length : personRows.length;

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
              ? t("subtitle", { date: selectedEvent.shortDate, count })
              : t("subtitleAthletes", { count })}
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
                {!selectedEvent && (
                  <>
                    <th className="results__races results__detail-col" scope="col">
                      {t("cols.races")}
                    </th>
                    <th className="results__race results__detail-col" scope="col">
                      {t("cols.race")}
                    </th>
                  </>
                )}
                <th className="results__time" scope="col">
                  {selectedEvent ? t("cols.time") : t("cols.bestTime")}
                </th>
                <th className="results__toggle-col">
                  <span className="sr-only">{t("detailsLabel")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {personRows.map((row) => {
                const isOpen = open === row.key;
                const podium = row.rank <= 3;
                const detailId = `results-detail-athlete-${row.rank}`;
                return (
                  <Fragment key={row.key}>
                    <tr className={podium ? "is-podium" : undefined}>
                      <td className="results__rank">{row.rank}</td>
                      <td className="results__name">{row.name}</td>
                      <td className="results__lvl results__detail-col">
                        {t("level", { n: row.level })}
                      </td>
                      <td className="results__cat results__detail-col">
                        {t(`category.${row.gender}`)}
                      </td>
                      <td className="results__races results__detail-col">{row.races}</td>
                      <td className="results__race results__detail-col">
                        {row.bestEvent.shortDate}
                      </td>
                      <td className="results__time">{formatTime(row.bestTimeCs)}</td>
                      <td className="results__toggle-cell">
                        <button
                          type="button"
                          className="results__toggle"
                          aria-expanded={isOpen}
                          aria-controls={detailId}
                          aria-label={t("detailsLabel")}
                          onClick={() => setOpen(isOpen ? null : row.key)}
                        >
                          <ChevronIcon className={isOpen ? "is-open" : undefined} />
                        </button>
                      </td>
                    </tr>
                    <tr id={detailId} className={`results__detail-row${isOpen ? " is-open" : ""}`}>
                      <td colSpan={8}>
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
                            <dt>{t("cols.races")}</dt>
                            <dd>{row.races}</dd>
                          </div>
                          <div>
                            <dt>{t("cols.race")}</dt>
                            <dd>{row.bestEvent.shortDate}</dd>
                          </div>
                        </dl>
                      </td>
                    </tr>
                  </Fragment>
                );
              })}
              {eventRows.map((row) => {
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
