/**
 * Rating series — the date windows the season rating is split into. Each
 * series is its own standings board, because its prizes are paid out
 * separately: a runner's mile in one series never counts toward another.
 *
 * A fixed business definition, not admin data: it changes once a season, and
 * when it does the prize terms change with it. Windows are inclusive ISO dates
 * and must not overlap; an event dated outside every window is in no rating.
 */
export type RatingSeries = {
  /** URL value (`/rating?series=<id>`) and the "Series {id}" label. */
  id: string;
  /** First day, inclusive, YYYY-MM-DD. */
  from: string;
  /** Last day, inclusive, YYYY-MM-DD. */
  to: string;
};

/** Oldest first. */
export const RATING_SERIES: readonly RatingSeries[] = [
  { id: "1", from: "2026-06-26", to: "2026-08-29" },
  { id: "2", from: "2026-09-22", to: "2026-10-28" },
];

/** The series an event dated `date` (YYYY-MM-DD) counts toward, if any. */
export function seriesOf(date: string): RatingSeries | undefined {
  return RATING_SERIES.find((s) => s.from <= date && date <= s.to);
}

/** "26.06" — the day.month a series window is labelled with. */
export function seriesDay(date: string): string {
  const [, m, d] = date.split("-");
  return `${d}.${m}`;
}
