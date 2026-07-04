import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import "@/app/landing.css";
import "@/app/series-flows.css";

import { InteriorHeader } from "@/components/landing/interior-header";
import { Link } from "@/i18n/navigation";
import { getEventBySlug, getSeriesEvents } from "@/lib/events/registry";
import type { EventStatus } from "@/lib/events/types";

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const DATE_TAG: Record<string, string> = { en: "en-GB", pl: "pl-PL", ua: "uk-UA" };

/** Config status → mockup detail display state (server-side; no live "full"). */
type DetailState = "open" | "soon" | "closed" | "completed";
function detailState(status: EventStatus): DetailState {
  if (status === "registration_open") return "open";
  if (status === "upcoming") return "soon";
  if (status === "completed") return "completed";
  return "closed";
}
const STATUS_KEY: Record<DetailState, string> = {
  open: "registration_open",
  soon: "upcoming",
  closed: "registration_closed",
  completed: "completed",
};
const BANNER_TONE: Record<DetailState, string> = {
  open: "info",
  soon: "warn",
  closed: "info",
  completed: "ok",
};

export function generateStaticParams() {
  return getSeriesEvents().map((event) => ({ slug: event.slug }));
}

type PageProps = { params: Promise<{ locale: string; slug: string }> };

export default async function EventDetailPage({ params }: PageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const event = getEventBySlug(slug);
  if (!event || event.eventType !== "individual") {
    notFound();
  }

  const t = await getTranslations("events");
  const state = detailState(event.status);
  const [, m, d] = event.date.split("-");
  const longDate = new Intl.DateTimeFormat(DATE_TAG[locale] ?? "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Warsaw",
  }).format(new Date(`${event.date}T12:00:00+02:00`));

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
                <Fact k={t("detail.facts.venue")} v={event.venue} />
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
                  <Link href={`/events/${slug}/register`} className="btn btn-red btn-block">
                    {t("detail.states.open.cta")}
                  </Link>
                ) : state === "closed" || state === "completed" ? (
                  <Link href="/#events" className="btn btn-stroke-dark btn-block">
                    {t(`detail.states.${state}.cta`)}
                  </Link>
                ) : (
                  <button type="button" className="btn btn-stroke-dark btn-block" disabled>
                    {t("detail.states.soon.cta")}
                  </button>
                )}

                <p className="slots-note">{t(`detail.states.${state}.note`)}</p>
              </div>
            </aside>
          </div>

          {event.timetable && event.timetable.length > 0 ? (
            <section className="ev-block" style={{ marginTop: "clamp(28px,4vw,44px)", maxWidth: 720 }}>
              <h2 className="ev-block__title">{t("detail.scheduleTitle")}</h2>
              <ul className="ev-timetable">
                {event.timetable.map((block) => (
                  <li key={block.labelKey} className="ev-timetable__row">
                    <span className="ev-timetable__time">{block.time}</span>
                    <span className="ev-timetable__label">{t(`timetable.${block.labelKey}`)}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </main>
    </div>
  );
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div className="fact">
      <div className="fact__k">{k}</div>
      <div className="fact__v">{v}</div>
    </div>
  );
}
