"use client";

import { Fragment, useState } from "react";
import { useTranslations } from "next-intl";

import { buildLeaderboard } from "@/lib/events/leaderboard";
import { computeLevel } from "@/lib/events/levels";
import { formatTime } from "@/lib/events/time";
import type { EventSummary, Gender } from "@/lib/events/types";

import { ChevronIcon } from "./icons";

/** The "all races" tab — deliberately not a valid event slug. */
const ALL = "all";

/** Rows shown per board before the "show all" expander takes over. */
const VISIBLE_ROWS = 10;

/** One display row — both the per-event and the series board reduce to this. */
type BoardRow = {
  /** Stable key, unique within its board. */
  id: string;
  /** 1-based place within the gender board. */
  rank: number;
  name: string;
  level: number;
  timeCs: number;
  /** Series board only: races finished. */
  races?: number;
  /** Series board only: the race the best time was set at. */
  raceDate?: string;
};

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
 * Men and women rank on separate boards — level bars are gender-specific, so a
 * shared place column would compare times that aren't comparable. Side by side
 * on wide screens, stacked on narrow ones. Each board opens at the top ten and
 * expands in place, so the section stays scannable as the series grows.
 *
 * Within a board the layout adapts to width without duplicating the data: it
 * stays a single `<table>`, but on narrow screens the detail columns (level /
 * races) collapse and each row gains an expand button that reveals them in a
 * stacked panel — so place, athlete, and time are always visible at a glance.
 */
export function Results({ events }: { events: EventSummary[] }) {
  const t = useTranslations("landing.results");
  const [selected, setSelected] = useState<string>(ALL);
  const [open, setOpen] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<Gender, boolean>>({ M: false, F: false });

  const withResults = events.filter((e) => e.results);
  if (withResults.length === 0) return null;

  const selectedEvent = withResults.find((e) => e.slug === selected) ?? null;

  const rowsFor = (gender: Gender): BoardRow[] => {
    if (selectedEvent) {
      // Per-event board: that race's own rows, ranked by time across its heats.
      return (selectedEvent.results?.heats ?? [])
        .flatMap((heat) =>
          heat.entries
            .filter((entry) => entry.gender === gender)
            .map((entry) => ({
              // Bibs are recycled leases (ADR 0003): only (event, heat, bib) is
              // unique, so the row id carries all three.
              id: `${selectedEvent.slug}:${heat.number}:${entry.bib}`,
              name: entry.name,
              timeCs: entry.timeCs,
            })),
        )
        .sort((a, b) => a.timeCs - b.timeCs)
        .map((row, i) => ({
          ...row,
          rank: i + 1,
          level: computeLevel(row.timeCs, gender),
        }));
    }
    // Series board: one row per person, best time counts. The shared board is
    // built once per gender pass — cheap at this scale, and re-ranking the
    // filtered slice keeps places consecutive within the gender.
    return buildLeaderboard(withResults)
      .filter((person) => person.gender === gender)
      .map((person, i) => ({
        id: person.key,
        rank: i + 1,
        name: person.name,
        level: person.level,
        timeCs: person.bestTimeCs,
        races: person.races,
        raceDate: person.bestEvent.shortDate,
      }));
  };

  const boards: { gender: Gender; rows: BoardRow[] }[] = [
    { gender: "M", rows: rowsFor("M") },
    { gender: "F", rows: rowsFor("F") },
  ];
  const count = boards.reduce((n, b) => n + b.rows.length, 0);

  const selectTab = (slug: string) => {
    setSelected(slug);
    setOpen(null);
    setExpanded({ M: false, F: false });
  };

  const isSeries = !selectedEvent;

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

        <div className="results__boards">
          {boards.map(({ gender, rows }) => {
            const isExpanded = expanded[gender];
            const visible = isExpanded ? rows : rows.slice(0, VISIBLE_ROWS);
            const boardId = `results-board-${gender}`;
            return (
              <div key={gender} className="results__board" role="group" aria-labelledby={boardId}>
                <div className="results__board-head">
                  <h3 id={boardId} className="results__board-title">
                    {t(`boards.${gender}`)}
                  </h3>
                  <span className="results__board-count">
                    {t("boardCount", { count: rows.length })}
                  </span>
                </div>
                {rows.length === 0 ? (
                  <p className="results__empty">{t("empty")}</p>
                ) : (
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
                          {isSeries && (
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
                            {isSeries ? t("cols.bestTime") : t("cols.time")}
                          </th>
                          <th className="results__toggle-col">
                            <span className="sr-only">{t("detailsLabel")}</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {visible.map((row) => {
                          const rowKey = `${gender}:${row.id}`;
                          const isOpen = open === rowKey;
                          const detailId = `results-detail-${gender}-${row.rank}`;
                          return (
                            <Fragment key={row.id}>
                              <tr className={row.rank <= 3 ? "is-podium" : undefined}>
                                <td className="results__rank">{row.rank}</td>
                                <td className="results__name">{row.name}</td>
                                <td className="results__lvl results__detail-col">
                                  {t("level", { n: row.level })}
                                </td>
                                {isSeries && (
                                  <>
                                    <td className="results__races results__detail-col">
                                      {row.races}
                                    </td>
                                    <td className="results__race results__detail-col">
                                      {row.raceDate}
                                    </td>
                                  </>
                                )}
                                <td className="results__time">{formatTime(row.timeCs)}</td>
                                <td className="results__toggle-cell">
                                  <button
                                    type="button"
                                    className="results__toggle"
                                    aria-expanded={isOpen}
                                    aria-controls={detailId}
                                    aria-label={t("detailsLabel")}
                                    onClick={() => setOpen(isOpen ? null : rowKey)}
                                  >
                                    <ChevronIcon className={isOpen ? "is-open" : undefined} />
                                  </button>
                                </td>
                              </tr>
                              <tr
                                id={detailId}
                                className={`results__detail-row${isOpen ? " is-open" : ""}`}
                              >
                                <td colSpan={isSeries ? 7 : 5}>
                                  <dl className="results__detail">
                                    <div>
                                      <dt>{t("cols.level")}</dt>
                                      <dd>{t("level", { n: row.level })}</dd>
                                    </div>
                                    {isSeries && (
                                      <>
                                        <div>
                                          <dt>{t("cols.races")}</dt>
                                          <dd>{row.races}</dd>
                                        </div>
                                        <div>
                                          <dt>{t("cols.race")}</dt>
                                          <dd>{row.raceDate}</dd>
                                        </div>
                                      </>
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
                )}
                {rows.length > VISIBLE_ROWS && (
                  <button
                    type="button"
                    className="results__more"
                    aria-expanded={isExpanded}
                    onClick={() =>
                      setExpanded((prev) => ({ ...prev, [gender]: !prev[gender] }))
                    }
                  >
                    {isExpanded ? t("showLess") : t("showAll", { count: rows.length })}
                    <ChevronIcon className={isExpanded ? "is-open" : undefined} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
