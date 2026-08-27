import { getTranslations } from "next-intl/server";

import { SeriesList, type RaceRow } from "@/features/event-registration/components/series-list";
import { getSeriesEvents } from "@/lib/events/registry";

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/**
 * Second section of the landing — the individual mile series overview. The head
 * + legend render on the server; the race list is a client island so it can
 * show live fullness (free/paid slots left) without making the page dynamic.
 * Hides itself when the series is empty.
 */
export async function EventSeries() {
  const events = await getSeriesEvents();
  if (events.length === 0) return null;

  const t = await getTranslations("events");

  const rows: RaceRow[] = events.map((event) => {
    const [y, m, d] = event.date.split("-");
    return {
      slug: event.slug,
      d,
      m: MONTHS[Number(m) - 1] ?? m,
      y,
      title: event.name,
      status: event.status,
      time: event.timeRange ? event.timeRange.start : null,
      venue: event.venue,
    };
  });

  const legend: Array<{ dot: string; key: string }> = [
    { dot: "ld-open", key: "registration_open" },
    { dot: "ld-soon", key: "upcoming" },
    { dot: "ld-closed", key: "registration_closed" },
    { dot: "ld-done", key: "completed" },
  ];

  return (
    <section id="events" className="section" data-screen-label="Series overview">
      <div className="wrap">
        <div className="series-head">
          <div className="page-head">
            <p className="ev-eyebrow">{t("series.kicker")}</p>
            <h2 className="head t-sec">{t("series.title")}</h2>
          </div>
          <div className="series-legend">
            {legend.map((l) => (
              <span key={l.key} className="legend-item">
                <span className={`legend-dot ${l.dot}`} />
                {t(`status.${l.key}`)}
              </span>
            ))}
          </div>
        </div>

        <SeriesList rows={rows} />
      </div>
    </section>
  );
}
