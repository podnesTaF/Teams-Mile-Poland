import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import "@/app/landing.css";
import "@/app/series-flows.css";
import "../heats/heats.css";

import { InteriorHeader } from "@/components/landing/interior-header";
import { Link } from "@/i18n/navigation";
import { getEventBySlug } from "@/lib/events/registry";
import { getPublicResults } from "@/lib/events/results-data";
import { formatEventLongDate, formatTime } from "@/lib/events/time";

/**
 * Fresh on every request — deliberately NOT the start list's
 * static-until-revalidated model. That page can afford to be cached because
 * bibs never render there and only three admin actions change it (PRD #26);
 * this page changes on every mid-event import, and a participant refreshing
 * between their qualification and the final must see the newest heat the
 * moment the operator commits it, not a cache that an invalidation has to
 * chase. Two scoped reads per request is the price, and race-night traffic
 * carries it easily (`node_modules/next/dist/docs` — route segment config,
 * `dynamic: 'force-dynamic'`).
 */
export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const event = getEventBySlug(slug);
  if (!event || event.eventType !== "individual") return {};
  const t = await getTranslations({ locale, namespace: "events" });
  return { title: `${event.name} — ${t("results.eyebrow")}` };
}

/**
 * Per-event results, updated during the event: each imported heat with places
 * and times, finishers first, then DNF/DSQ/DNS — a non-finisher is shown as
 * such rather than silently dropped, which mid-event is the honest answer to
 * "where did I place?" (the landing leaderboard stays finishers-only).
 *
 * Fully public, like the start list next door. `data-results-*` markers are
 * for end-to-end checks: streamed pages cannot be told apart by status code.
 */
export default async function EventResultsPage({ params }: PageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const event = getEventBySlug(slug);
  if (!event || event.eventType !== "individual") {
    notFound();
  }

  const t = await getTranslations("events");
  const results = await getPublicResults(slug);

  return (
    <div className="ace-landing iv">
      <InteriorHeader />
      <main className="iv-main">
        <div className="iv-wrap">
          <Link href={`/events/${slug}`} className="detail-back">
            {t("results.back")}
          </Link>

          <span className="iv-eyebrow">{t("results.eyebrow")}</span>
          <h1 className="iv-title">{event.name}</h1>
          <p className="iv-sub">
            {formatEventLongDate(locale, event.date)} · {event.venue}, {event.city}
          </p>

          {results ? (
            <>
              {/* Mid-event honesty: these tables can grow heat by heat while
                  the night is still running. */}
              {event.status !== "completed" ? (
                <p className="iv-meta sl-approx">{t("results.provisionalNote")}</p>
              ) : null}
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
                              // Bibs are per-heat leases (ADR 0003): within one
                              // heat the bib alone is unique.
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
          ) : (
            <div className="iv-card sl-state" data-results-empty>
              <h2 className="sl-state__title">{t("results.empty.title")}</h2>
              <p className="sl-state__txt">{t("results.empty.txt")}</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
