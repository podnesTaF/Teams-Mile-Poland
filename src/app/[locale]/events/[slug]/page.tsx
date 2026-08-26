import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import "@/app/landing.css";
import "@/app/series-flows.css";
import "@/app/gallery.css";
import "./heats/heats.css";

import { InteriorHeader } from "@/components/landing/interior-header";
import { EventRegisterCta } from "@/features/event-registration/components/event-register-cta";
import { ResultsTables } from "@/features/event-results/results-tables";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getEventDocuments, resolveDocumentFile } from "@/lib/events/documents";
import { getEventMediaConfig } from "@/lib/events/media-config";
import { getEventBySlug, getIndividualEvents } from "@/lib/events/registry";
import { getPublicResults } from "@/lib/events/results-data";
// Straight from the store, not the `registry` compat shim: `isPubliclyVisible`
// is new API, and the shim exists only so the pre-DB call sites kept compiling.
import { isPubliclyVisible } from "@/lib/events/store";
import { formatEventLongDate } from "@/lib/events/time";
import type { EventStatus } from "@/lib/events/types";
import { defaultLocale } from "@/lib/i18n/config";
import { venueMapsUrl } from "@/lib/marketing/event";

import { EventMediaTeaser } from "./event-media-teaser";

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** Lifecycle status → mockup detail display state (server-side; no live "full"). */
type DetailState = "open" | "soon" | "closed" | "completed" | "cancelled";
function detailState(status: EventStatus): DetailState {
  switch (status) {
    case "registration_open":
      return "open";
    case "upcoming":
      return "soon";
    case "completed":
      return "completed";
    case "cancelled":
      return "cancelled";
    // `draft` has no public display state, because it never gets one: an
    // unannounced night 404s on every public surface before this page renders,
    // and it is left out of `generateStaticParams` besides. This arm exists
    // only to keep the function total, and it answers with the most inert
    // state there is — `soon` renders a disabled button and no start list, no
    // results and no gallery — so that even a hole in the visibility guard
    // would advertise nothing about an unannounced night.
    case "draft":
      return "soon";
    case "registration_closed":
      return "closed";
  }
}
const STATUS_KEY: Record<DetailState, string> = {
  open: "registration_open",
  soon: "upcoming",
  closed: "registration_closed",
  completed: "completed",
  cancelled: "cancelled",
};
const BANNER_TONE: Record<DetailState, string> = {
  open: "info",
  soon: "warn",
  closed: "info",
  completed: "ok",
  // `red` is the stylesheet's error tone (`series-flows.css` defines
  // `banner--warn|red|info|ok`, and nothing else).
  cancelled: "red",
};

/**
 * Safety-net ISR: a write that bypasses the app (a manual DB correction, a
 * seed) reaches no `revalidatePath` and would leave this page stale until a
 * deploy. Five minutes bounds that; admin actions still invalidate instantly.
 * Must stay a literal — the value is statically analyzed.
 */
export const revalidate = 300;

export async function generateStaticParams() {
  // Individual events including completed ones — a race night that flips to
  // `completed` must keep its detail page (gallery teaser, gallery back-link,
  // and the media-live mailing CTA all point at it). `getSeriesEvents` drops
  // completed events and drives landing cards, so it can't back the params.
  //
  // Filtered by `isPubliclyVisible`, which drops drafts and keeps cancelled
  // nights: a cancelled night's page still renders (with its banner), an
  // unannounced one has no page at all. Prerendering a draft would publish the
  // slug — and the name, date and venue on it — the moment it was created.
  // `dynamicParams` stays at its default `true`, so a draft that is later
  // announced renders on first request without a deploy.
  return (await getIndividualEvents())
    .filter(isPubliclyVisible)
    .map((event) => ({ slug: event.slug }));
}

type PageProps = { params: Promise<{ locale: string; slug: string }> };

export default async function EventDetailPage({ params }: PageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const event = await getEventBySlug(slug);
  // A draft is indistinguishable from a slug that does not exist: not published,
  // so not found — for an admin reading this page too, since the admin's view of
  // a draft lives in `/admin`. `dynamicParams` means an un-prerendered slug still
  // reaches this handler, so the gate has to be here and not only in the params.
  if (!event || event.eventType !== "individual" || !isPubliclyVisible(event)) {
    notFound();
  }

  const t = await getTranslations("events");
  const state = detailState(event.status);
  // The event's results — imported rows or a legacy config sheet. Read at
  // build/revalidate time: this page is SSG, and the import commit revalidates
  // it, so results appear with the first mid-event import rather than waiting
  // for a redeploy. Mid-event (`closed`) they only drive the sidebar link;
  // once `completed` they render inline — this page is the event's archive.
  const results =
    state === "closed" || state === "completed" ? await getPublicResults(slug) : null;
  const hasResults = results !== null;
  // Published media (the `event_media` row an admin created). Same caching
  // story: the publish action revalidates this page, flipping the coming-soon
  // note into the teaser without a deploy.
  const media = state === "completed" ? await getEventMediaConfig(slug) : null;
  const docLocale = hasLocale(routing.locales, locale) ? locale : defaultLocale;
  const docs = getEventDocuments(slug).flatMap((doc) => {
    const resolved = resolveDocumentFile(doc, docLocale);
    return resolved ? [{ id: doc.id, labelKey: doc.labelKey, ...resolved }] : [];
  });
  const [, m, d] = event.date.split("-");
  const longDate = formatEventLongDate(locale, event.date);

  return (
    <div className="ace-landing iv">
      <InteriorHeader />
      <main className="iv-main">
        <div className="wrap">
          <Link href="/#events" className="detail-back">
            {t("detail.back")}
          </Link>

          <div className="detail-grid">
            <div className="detail-card">
              <div className="detail-hero">
                <div className="detail-hero__badge">
                  <span className={`status status--${state}`}>
                    <span className="status__dot" />
                    {t(`status.${STATUS_KEY[state]}`)}
                  </span>
                </div>
                <span className="ev-eyebrow">{t(`detail.states.${state}.kicker`)}</span>
                <h2 className="detail-title">{event.name}</h2>
                <p className="detail-sub">
                  {longDate} · {event.venue}, {event.city}
                </p>
              </div>

              <div className="detail-facts">
                <Fact k={t("detail.facts.date")} v={`${d} ${MONTHS[Number(m) - 1] ?? m}`} />
                <Fact k={t("detail.facts.gun")} v={event.timeRange?.start ?? "—"} />
                <Fact
                  k={t("detail.facts.venue")}
                  v={event.venue}
                  href={venueMapsUrl(event.venue, event.city)}
                />
                <Fact k={t("detail.facts.distance")} v={t("detail.distanceValue")} />
              </div>

              <div className="detail-terms">
                <div className={`banner banner--${BANNER_TONE[state]}`}>
                  <span className="banner__ic">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 8h.01M11 12h1v4h1" strokeLinecap="round" />
                    </svg>
                  </span>
                  <div className="banner__body">
                    <div className="banner__title">{t(`detail.states.${state}.bannerTitle`)}</div>
                    <div className="banner__txt">{t(`detail.states.${state}.bannerTxt`)}</div>
                  </div>
                </div>
              </div>

              {/* Attached files. Static for now — every event shares the same
                  regulations PDF, picked to match the reader's locale. */}
              {docs.length > 0 && (
                <div className="detail-docs">
                  <span className="ev-eyebrow">{t("docs.heading")}</span>
                  <ul className="doc-list">
                    {docs.map((doc) => (
                      <li key={doc.id}>
                        <a className="doc-row" href={doc.file.href} target="_blank" rel="noopener">
                          <span className="doc-row__ic" aria-hidden>
                            PDF
                          </span>
                          <span className="doc-row__body">
                            <span className="doc-row__title">
                              {t(`docs.items.${doc.labelKey}`)}
                            </span>
                            <span className="doc-row__meta">
                              {`PDF · ${doc.file.lang.toUpperCase()}`}
                              {doc.isFallback ? ` · ${t("docs.fallback")}` : ""}
                            </span>
                          </span>
                          <span className="doc-row__act">
                            {t("docs.download")}
                            <span aria-hidden> ↓</span>
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <aside>
              <div className="slots-card">
                <div className="slots-row">
                  <div className="slots-lbl">
                    <b>{t("detail.slots.entry")}</b>
                    <small>{t("detail.slots.entrySub")}</small>
                  </div>
                  <div className="slots-val slots-val--free">{t("detail.slots.free")}</div>
                </div>

                {state === "open" ? (
                  <EventRegisterCta
                    slug={slug}
                    registerLabel={t("detail.states.open.cta")}
                    createLabel={t("detail.cta.create")}
                    signInPrompt={t("detail.cta.signInPrompt")}
                    signInLabel={t("detail.cta.signIn")}
                  />
                ) : state === "cancelled" ? (
                  // A cancelled night never offers registration — the banner
                  // above says it is off, and this points back at the nights
                  // that are still on.
                  <Link href="/#events" className="btn btn-stroke-dark btn-block">
                    {t("detail.states.cancelled.cta")}
                  </Link>
                ) : state === "completed" && hasResults ? (
                  // "View results →" points at this page's own inline results
                  // section — the archive body right below — not the landing.
                  <a href="#results" className="btn btn-stroke-dark btn-block">
                    {t("detail.states.completed.cta")}
                  </a>
                ) : state === "closed" || state === "completed" ? (
                  // Completed without results yet borrows the closed state's
                  // "pick another night" label: its own says "View results",
                  // which would lie on a link back to the events list.
                  <Link href="/#events" className="btn btn-stroke-dark btn-block">
                    {t("detail.states.closed.cta")}
                  </Link>
                ) : (
                  <button type="button" className="btn btn-stroke-dark btn-block" disabled>
                    {t("detail.states.soon.cta")}
                  </button>
                )}

                <p className="slots-note">{t(`detail.states.${state}.note`)}</p>

                {/* The start list, once entries have closed and the card is
                    being built. Config-derived so this page stays static: the
                    link is shown for the whole `registration_closed` window and
                    the start list itself renders its own "not published yet"
                    state until an admin publishes. */}
                {state === "closed" ? (
                  <Link
                    href={`/events/${slug}/heats`}
                    className="btn btn-stroke-dark btn-block slots-link"
                  >
                    {t("heats.cta")}
                  </Link>
                ) : null}

                {/* Results link, mid-event only (`closed`, heats are being
                    imported between rounds) — once `completed` the tables are
                    inline on this page and the primary CTA above jumps there. */}
                {hasResults && state === "closed" ? (
                  <Link
                    href={`/events/${slug}/results`}
                    className="btn btn-stroke-dark btn-block slots-link"
                  >
                    {t("results.cta")}
                  </Link>
                ) : null}
              </div>
            </aside>
          </div>

          {/* The archive body — only on completed events: results first,
              gallery preview second. */}
          {state === "completed" && results ? (
            <section className="detail-results" id="results" data-detail-results>
              <span className="ev-eyebrow">{t("results.eyebrow")}</span>
              <ResultsTables results={results} />
            </section>
          ) : null}

          {/* Media section — only on completed events. Published (an
              `event_media` row exists): a teaser strip into the gallery.
              Completed without a row: a coming-soon note. Non-completed
              states render nothing. */}
          {state === "completed" &&
            (media ? (
              <EventMediaTeaser
                slug={slug}
                folderId={media.driveFolderId}
                heading={t("media.teaserHeading")}
                viewAll={t("media.viewAll")}
                videoCount={(count) => t("media.videoCount", { count })}
                comingSoon={t("media.comingSoon")}
              />
            ) : (
              <section className="media-soon">
                <span className="ev-eyebrow">{t("media.teaserHeading")}</span>
                <p className="media-soon__txt">{t("media.comingSoon")}</p>
              </section>
            ))}
        </div>
      </main>
    </div>
  );
}

/** A key/value cell. With `href` the value becomes an external link (the venue
 *  opens the venue on Google Maps). */
function Fact({ k, v, href }: { k: string; v: string; href?: string }) {
  return (
    <div className="fact">
      <div className="fact__k">{k}</div>
      <div className="fact__v">
        {href ? (
          <a className="fact__link" href={href} target="_blank" rel="noopener noreferrer">
            {v}
          </a>
        ) : (
          v
        )}
      </div>
    </div>
  );
}
