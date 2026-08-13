import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import "@/app/landing.css";
import "@/app/series-flows.css";
import "./heats.css";

import { InteriorHeader } from "@/components/landing/interior-header";
import { getEventStartList, type StartList } from "@/features/event-heats/start-list";
import { Link } from "@/i18n/navigation";
import { formatHeatTime } from "@/lib/events/heat-time";
import { getEventBySlug } from "@/lib/events/registry";
import { getMergedResults } from "@/lib/events/results-data";
import { formatEventLongDate } from "@/lib/events/time";

/**
 * Empty on purpose, and present on purpose.
 *
 * Nothing is prerendered at build time — the card does not exist yet when the
 * site is built, and freezing one would be wrong. But the empty array is what
 * makes each path render on its *first* visit and then be cached until
 * `revalidateStartList()` invalidates it; omitting `generateStaticParams`
 * entirely would re-render the page on every request instead, which turns the
 * publish/edit/finish revalidation into a no-op and puts two queries on every
 * spectator refresh (verified against `node_modules/next/dist/docs` —
 * "All paths at runtime").
 */
export function generateStaticParams() {
  return [];
}

type PageProps = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const event = getEventBySlug(slug);
  if (!event || event.eventType !== "individual") return {};
  const t = await getTranslations({ locale, namespace: "events" });
  return { title: `${event.name} — ${t("heats.eyebrow")}` };
}

/**
 * The public start list for one event's published heats.
 *
 * Rendered on demand and invalidated by `revalidateStartList()` from the
 * publish / heat-edit / finish actions (PRD #26 cross-cutting decision 4) — see
 * {@link generateStaticParams}. Sibling routes under `events/[slug]` (the detail
 * page, the gallery) are prerendered at build time from the registry; this is the
 * feature's only touch on the public cache.
 */
export default async function EventStartListPage({ params }: PageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const event = getEventBySlug(slug);
  // Fully public — no auth gate. Heats exist for individual events only.
  if (!event || event.eventType !== "individual") {
    notFound();
  }

  const t = await getTranslations("events");

  // Heats are meaningful only for `registration_closed` and the run-up to the
  // event: `upcoming` has nobody registered to seed, and a `completed` race
  // night's results, not its start list, are the interesting artefact by then
  // (PRD #26 cross-cutting decision 3 — "upcoming and completed show nothing").
  // Both land on the empty state without a DB round-trip.
  const dormant = event.status === "upcoming" || event.status === "completed";
  const startList: StartList = dormant
    ? { totalHeats: 0, heats: [] }
    : await getEventStartList(slug);

  // Whether to point the runner onward to the results page. A new dependency
  // for this cached page, and a deliberate one: the import commit revalidates
  // the start list (results-actions.ts), so the link appears with the first
  // mid-event import — the moment "check your results" becomes a true sentence.
  const hasResults = (await getMergedResults([slug])).has(slug);

  const state =
    startList.heats.length > 0
      ? "published"
      : startList.totalHeats > 0
        ? // The card is built but still draft — an explicit "not yet", never an
          // empty page, so waiting does not read as broken.
          "unpublished"
        : "empty";

  return (
    <div className="ace-landing iv">
      <InteriorHeader />
      <main className="iv-main">
        <div className="iv-wrap">
          <Link href={`/events/${slug}`} className="detail-back">
            {t("heats.back")}
          </Link>

          <span className="iv-eyebrow">{t("heats.eyebrow")}</span>
          <h1 className="iv-title">{event.name}</h1>
          <p className="iv-sub">
            {formatEventLongDate(locale, event.date)} · {event.venue}, {event.city}
          </p>

          {hasResults ? (
            <p className="sl-approx">
              <Link href={`/events/${slug}/results`} className="btn btn-stroke-dark">
                {t("results.cta")}
              </Link>
            </p>
          ) : null}

          {state === "published" ? (
            <>
              <p className="iv-meta sl-approx">{t("heats.approxNote")}</p>
              <div className="sl-heats">
                {/* One block per heat: its number and approximate start time as
                    the heading, its runners underneath. Grouping by heat rather
                    than adding a heat column is what a start list looks like on
                    a stadium wall, and it keeps the time next to the people it
                    applies to. */}
                {startList.heats.map((heat) => (
                  <article className="sl-heat" key={heat.number}>
                    <header className="sl-heat__head">
                      <h2 className="sl-heat__no">{t("heats.heat", { number: heat.number })}</h2>
                      <span className="sl-heat__time">
                        {t("heats.approxTime", { time: formatHeatTime(heat.scheduledAt) })}
                      </span>
                      <span className="sl-heat__count">
                        {t("heats.runners", { count: heat.entries.length })}
                      </span>
                    </header>

                    {heat.entries.length === 0 ? (
                      // A published heat nobody is seeded into yet — a real
                      // state on a card that is still being balanced.
                      <p className="iv-empty">{t("heats.heatEmpty")}</p>
                    ) : (
                      <div className="iv-tablewrap">
                        <table className="iv-table sl-table">
                          <thead>
                            <tr>
                              <th>{t("heats.colName")}</th>
                              <th>{t("heats.colClub")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {heat.entries.map((entry) => (
                              <tr key={entry.registrationId}>
                                <td className="sl-table__name">{entry.name}</td>
                                <td className="sl-table__club">{entry.club || "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </>
          ) : (
            <div className="iv-card sl-state">
              <h2 className="sl-state__title">{t(`heats.${state}.title`)}</h2>
              <p className="sl-state__txt">{t(`heats.${state}.txt`)}</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
