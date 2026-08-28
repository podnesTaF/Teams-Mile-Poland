import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import "@/app/landing.css";
import "@/app/series-flows.css";
import "../heats/heats.css";

import { InteriorHeader } from "@/components/landing/interior-header";
import { ResultsTables } from "@/features/event-results/results-tables";
import { Link } from "@/i18n/navigation";
import { getEventBySlug } from "@/lib/events/registry";
import { getPublicResults } from "@/lib/events/results-data";
// Straight from the store, not the `registry` compat shim: `isPubliclyVisible`
// is new API, and the shim exists only so the pre-DB call sites kept compiling.
import { isPubliclyVisible } from "@/lib/events/store";
import { formatEventLongDate } from "@/lib/events/time";
import { RACE_RESULT_GROUP_URL } from "@/lib/events/types";

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
  const event = await getEventBySlug(slug);
  // Same gate as the page: an unannounced night gets no title, in a tab or a
  // share card, because metadata renders before the body that 404s.
  if (!event || event.eventType !== "individual" || !isPubliclyVisible(event)) {
    notFound();
  }
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

  const event = await getEventBySlug(slug);
  // A draft never has a public page (`isPubliclyVisible`). A cancelled night
  // does: if it was called off mid-series after heats had already run, the
  // results that exist stay readable — this page is a record, not a promotion.
  if (!event || event.eventType !== "individual" || !isPubliclyVisible(event)) {
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
          {/* Outside the results/empty fork on purpose: before the first heat
              is imported, the timing system's own page is where live times
              are — the link matters most when the tables below are empty. */}
          <p className="iv-meta">
            <a
              className="iv-extlink"
              href={RACE_RESULT_GROUP_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("results.raceResult")}
              <span aria-hidden="true"> ↗</span>
            </a>
          </p>

          {results ? (
            <>
              {/* Mid-event honesty: these tables can grow heat by heat while
                  the night is still running. */}
              {event.status !== "completed" ? (
                <p className="iv-meta sl-approx">{t("results.provisionalNote")}</p>
              ) : null}
              <ResultsTables results={results} />
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
