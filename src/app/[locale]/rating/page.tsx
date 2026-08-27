import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import "@/app/landing.css";
import "@/app/series-flows.css";
import "../events/[slug]/heats/heats.css";

import { InteriorHeader } from "@/components/landing/interior-header";
import { Link } from "@/i18n/navigation";
import { buildLeaderboard, type LeaderboardPerson } from "@/lib/events/leaderboard";
import { getResultsEventsWithDb } from "@/lib/events/results-data";
import { formatTime } from "@/lib/events/time";
import type { Gender } from "@/lib/events/types";

/**
 * Fresh on every request, same reasoning as the per-event results page: a
 * mid-event import reshuffles the standings, and a runner refreshing between
 * heats must see the newest board, not a cache an invalidation has to chase.
 */
export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "rating" });
  return { title: t("title") };
}

/**
 * The season rating — the series standings the landing's results section links
 * to as its last tab. One row per athlete, ranked by their best mile across
 * every completed race (see `lib/events/leaderboard.ts`); men and women hold
 * separate boards because the level bars are gender-specific.
 */
export default async function RatingPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("rating");
  const events = await getResultsEventsWithDb();
  const people = buildLeaderboard(events);
  const boards: { gender: Gender; rows: LeaderboardPerson[] }[] = (["M", "F"] as const).map(
    (gender) => ({
      gender,
      // Re-ranked within the gender so places stay consecutive on each board.
      rows: people.filter((p) => p.gender === gender).map((p, i) => ({ ...p, rank: i + 1 })),
    }),
  );

  return (
    <div className="ace-landing iv">
      <InteriorHeader />
      <main className="iv-main">
        <div className="iv-wrap">
          <Link href="/#results" className="detail-back">
            {t("back")}
          </Link>

          <span className="iv-eyebrow">{t("eyebrow")}</span>
          <h1 className="iv-title">{t("title")}</h1>
          <p className="iv-sub">{t("subtitle", { races: events.length, count: people.length })}</p>

          {people.length === 0 ? (
            <div className="iv-card sl-state" data-rating-empty>
              <h2 className="sl-state__title">{t("empty.title")}</h2>
              <p className="sl-state__txt">{t("empty.txt")}</p>
            </div>
          ) : (
            <div className="sl-heats">
              {boards.map(({ gender, rows }) =>
                rows.length === 0 ? null : (
                  <article className="sl-heat" key={gender} data-rating-board={gender}>
                    <header className="sl-heat__head">
                      <h2 className="sl-heat__no">{t(`boards.${gender}`)}</h2>
                      <span className="sl-heat__count">{t("count", { count: rows.length })}</span>
                    </header>
                    <div className="iv-tablewrap">
                      <table className="iv-table sl-table">
                        <thead>
                          <tr>
                            <th>{t("cols.place")}</th>
                            <th>{t("cols.name")}</th>
                            <th>{t("cols.level")}</th>
                            <th>{t("cols.races")}</th>
                            <th>{t("cols.race")}</th>
                            <th>{t("cols.bestTime")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row) => (
                            <tr key={row.key}>
                              <td>{row.rank}</td>
                              <td className="sl-table__name">{row.name}</td>
                              <td>{t("level", { n: row.level })}</td>
                              <td>{row.races}</td>
                              <td className="sl-table__club">{row.bestEvent.shortDate}</td>
                              <td>{formatTime(row.bestTimeCs)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </article>
                ),
              )}
            </div>
          )}

          {people.length > 0 && <p className="iv-meta sl-approx">{t("note")}</p>}
        </div>
      </main>
    </div>
  );
}
