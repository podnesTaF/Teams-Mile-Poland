import { EVENT } from "@/lib/marketing/event";

import { currentSeries, seriesDay } from "./rating-series";
import { getStackEvents, isPubliclyVisible } from "./store";
import { firstHeatTime } from "./timetables";

/** One dot on the landing hero's season strip. */
export type SeasonNight = {
  slug: string;
  /** "22.09" */
  day: string;
  /** The night has run (status `completed`, or its date is behind us). */
  done: boolean;
  /** The soonest night that has not run — at most one. */
  next: boolean;
  /** The series' closing night. */
  last: boolean;
};

export type SeasonStrip = {
  /** Every public, not-cancelled night of the current rating series, soonest first. */
  nights: SeasonNight[];
  /** The series window, as "22.09" / "28.10". */
  from: string;
  to: string;
  /** Venue and times of the next night (or the last one, once the series is over). */
  venue: string;
  checkIn: string | null;
  firstHeat: string | null;
};

/** Today's date in Warsaw as YYYY-MM-DD — the calendar the series windows are in. */
function warsawToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * The season strip the landing hero draws: the nights of the current rating
 * series (`RATING_SERIES`, the window containing today), each linked to its
 * event page. Done / next / later follow the events' lifecycle status, with a
 * date guard so a night that ran but has not been marked `completed` yet is
 * not shown as still to come. Drafts and cancelled nights are left out, as
 * everywhere else the site promotes a night.
 */
export async function getSeasonStrip(): Promise<SeasonStrip> {
  const today = warsawToday();
  const series = currentSeries(today);
  const all = await getStackEvents();
  const events = all.filter(
    (e) =>
      isPubliclyVisible(e) &&
      e.status !== "cancelled" &&
      series.from <= e.date &&
      e.date <= series.to,
  );
  const isDone = (e: (typeof events)[number]) => e.status === "completed" || e.date < today;
  const nextIdx = events.findIndex((e) => !isDone(e));
  const nights = events.map((e, i) => ({
    slug: e.slug,
    day: seriesDay(e.date),
    done: isDone(e),
    next: i === nextIdx,
    last: i === events.length - 1,
  }));
  const ref = events[nextIdx] ?? events[events.length - 1];
  const checkIn = ref?.timeRange?.start ?? null;
  return {
    nights,
    from: seriesDay(series.from),
    to: seriesDay(series.to),
    venue: ref?.venue ?? EVENT.venue.name,
    checkIn,
    firstHeat: checkIn ? firstHeatTime(checkIn) : null,
  };
}
