"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { computeLevel } from "@/lib/events/levels";
import { formatTime } from "@/lib/events/time";
import type { EventSummary, Gender } from "@/lib/events/types";

/** Ranks shown before "show all" — podium (1–3) plus the table (4–10). */
const VISIBLE_ROWS = 10;

/** One ranked finisher of the selected race, within the selected category. */
type Row = {
  /** Stable key, unique within the race (bibs are per-heat leases, ADR 0003). */
  id: string;
  /** 1-based place within the gender category. */
  rank: number;
  name: string;
  level: number;
  timeCs: number;
};

/**
 * Results section — the latest race night's outcome, rendered directly below
 * the hero when at least one completed event has results.
 *
 * The standard race-results pattern: pick a race (date tabs, newest first and
 * selected by default), pick a category (men / women — they rank separately,
 * because the level bars are gender-specific and a shared place column would
 * compare times that aren't comparable), see the podium as cards and places
 * 4–10 as a compact table. Everything beyond that lives one click away: "show
 * all" expands the table in place, the race's own page carries the heat-by-heat
 * sheets, and the series standings have a dedicated page — the tab row's last
 * option, "season rating", links there instead of rendering a board inline.
 */
export function Results({ events }: { events: EventSummary[] }) {
  const t = useTranslations("landing.results");
  // Events arrive newest-first (`getPastEvents`), so [0] is the latest race.
  const withResults = events.filter((e) => e.results);
  const [selected, setSelected] = useState<string>(withResults[0]?.slug ?? "");
  const [gender, setGender] = useState<Gender>("M");
  const [showAll, setShowAll] = useState(false);

  if (withResults.length === 0) return null;
  const event = withResults.find((e) => e.slug === selected) ?? withResults[0];

  const rows: Row[] = (event.results?.heats ?? [])
    .flatMap((heat) =>
      heat.entries
        .filter((entry) => entry.gender === gender)
        .map((entry) => ({
          id: `${heat.number}:${entry.bib}`,
          name: entry.name,
          timeCs: entry.timeCs,
        })),
    )
    .sort((a, b) => a.timeCs - b.timeCs)
    .map((row, i) => ({ ...row, rank: i + 1, level: computeLevel(row.timeCs, gender) }));

  const finishers = (event.results?.heats ?? []).reduce((n, h) => n + h.entries.length, 0);
  const podium = rows.slice(0, 3);
  const rest = showAll ? rows.slice(3) : rows.slice(3, VISIBLE_ROWS);
  const hasMore = rows.length > VISIBLE_ROWS;
  // The heat-by-heat results page exists for individual events only — the
  // legacy team night keeps its rows here and expands inline instead.
  const fullResultsHref =
    (event.eventType ?? "team") === "individual" ? `/events/${event.slug}/results` : null;

  const selectRace = (slug: string) => {
    setSelected(slug);
    setShowAll(false);
  };
  const selectGender = (g: Gender) => {
    setGender(g);
    setShowAll(false);
  };

  return (
    <section className="section results" id="results" data-screen-label="Results">
      <div className="wrap">
        <div className="center stack" style={{ gap: 10 }}>
          <span className="results__eyebrow">{t("eyebrow")}</span>
          <h2 className="head t-sec">{t("title")}</h2>
          <p className="head t-20" style={{ opacity: 0.6 }}>
            {t("subtitle", { date: event.shortDate, count: finishers })}
          </p>
        </div>

        <div className="results__tabs" role="group" aria-label={t("tabsLabel")}>
          {withResults.map((e) => (
            <button
              key={e.slug}
              type="button"
              className="results__tab"
              aria-pressed={e.slug === event.slug}
              onClick={() => selectRace(e.slug)}
            >
              {e.shortDate}
            </button>
          ))}
          {/* The series standings live on their own page — always the last option. */}
          <Link href="/rating" className="results__tab results__tab--link">
            {t("ratingLink")}
            <span aria-hidden="true"> →</span>
          </Link>
        </div>

        <div className="results__gender" role="group" aria-label={t("genderLabel")}>
          {(["M", "F"] as const).map((g) => (
            <button
              key={g}
              type="button"
              className="results__gender-btn"
              aria-pressed={gender === g}
              onClick={() => selectGender(g)}
            >
              {t(`gender.${g}`)}
            </button>
          ))}
        </div>

        {rows.length === 0 ? (
          <p className="results__empty">{t("empty")}</p>
        ) : (
          <>
            <ol className="results__podium">
              {podium.map((row) => (
                <li
                  key={row.id}
                  className={`results__podium-card is-p${row.rank}`}
                  value={row.rank}
                >
                  <span className="results__podium-place" aria-hidden="true">
                    {row.rank}
                  </span>
                  <span className="results__podium-name">{row.name}</span>
                  <span className="results__podium-time">{formatTime(row.timeCs)}</span>
                  <span className="results__podium-level">{t("level", { n: row.level })}</span>
                </li>
              ))}
            </ol>

            {rest.length > 0 && (
              <div className="results__scroll">
                <table className="results__table">
                  <thead>
                    <tr>
                      <th className="results__rank" scope="col">
                        {t("cols.place")}
                      </th>
                      <th scope="col">{t("cols.name")}</th>
                      <th className="results__lvl" scope="col">
                        {t("cols.level")}
                      </th>
                      <th className="results__time" scope="col">
                        {t("cols.time")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rest.map((row) => (
                      <tr key={row.id}>
                        <td className="results__rank">{row.rank}</td>
                        <td className="results__name">{row.name}</td>
                        <td className="results__lvl">{t("level", { n: row.level })}</td>
                        <td className="results__time">{formatTime(row.timeCs)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {(hasMore || fullResultsHref) && (
              <div className="results__actions">
                {hasMore && (
                  <button
                    type="button"
                    className="results__action"
                    aria-expanded={showAll}
                    onClick={() => setShowAll((v) => !v)}
                  >
                    {showAll ? t("showLess") : t("showAll", { count: rows.length })}
                  </button>
                )}
                {fullResultsHref && (
                  <Link href={fullResultsHref} className="results__action results__action--link">
                    {t("fullResults")}
                    <span aria-hidden="true"> →</span>
                  </Link>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
