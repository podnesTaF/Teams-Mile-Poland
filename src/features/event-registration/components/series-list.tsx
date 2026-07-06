import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import type { EventStatus } from "@/lib/events/types";

export type RaceRow = {
  slug: string;
  d: string;
  m: string;
  y: string;
  title: string;
  status: EventStatus;
  time: string | null;
  venue: string;
};

type DisplayState = "open" | "soon" | "closed" | "completed";

function displayState(status: EventStatus): DisplayState {
  if (status === "registration_open") return "open";
  if (status === "upcoming") return "soon";
  if (status === "completed") return "completed";
  return "closed";
}

/**
 * Landing series list. Registration is free and uncapped, so rows show the
 * date, status and a CTA (no fullness bars). Each row links to the event
 * detail page.
 */
export function SeriesList({ rows }: { rows: RaceRow[] }) {
  const t = useTranslations("events");

  const statusLabel: Record<DisplayState, string> = {
    open: t("status.registration_open"),
    soon: t("status.upcoming"),
    closed: t("status.registration_closed"),
    completed: t("status.completed"),
  };
  const ctaLabel: Record<DisplayState, string> = {
    open: t("card.register"),
    soon: t("card.opensSoon"),
    closed: t("card.viewDetails"),
    completed: t("card.viewResults"),
  };

  return (
    <div className="series-list">
      {rows.map((r) => {
        const state = displayState(r.status);
        return (
          <Link
            key={r.slug}
            href={`/events/${r.slug}`}
            className="race-row is-actionable"
            data-state={state}
          >
            <div className="race-date">
              <span className="race-date__d">{r.d}</span>
              <span className="race-date__m">{r.m}</span>
              <span className="race-date__y">{r.y}</span>
            </div>

            <div className="race-info">
              <div className="race-info__top">
                <span className="race-title">{r.title}</span>
              </div>
              <div className="race-meta">
                {r.time ? (
                  <span>
                    {r.time} {t("card.gun")}
                  </span>
                ) : null}
                <span>{r.venue}</span>
              </div>
            </div>

            <div className="race-cta">
              <span className={`status status--${state}`}>
                <span className="status__dot" />
                {statusLabel[state]}
              </span>
              <span className="btn btn-red btn-sm">{ctaLabel[state]}</span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
