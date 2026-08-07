/** Locale → BCP 47 tag for date formatting. */
const DATE_TAG: Record<string, string> = { en: "en-GB", pl: "pl-PL", ua: "uk-UA" };

/**
 * An event's calendar date in the reader's language — "1 August 2026" /
 * "1 sierpnia 2026" / "1 серпня 2026" — as the public event surfaces head
 * themselves.
 *
 * `date` is a plain `YYYY-MM-DD` from the registry, not an instant. It is
 * anchored at local noon before formatting so the displayed day cannot slip
 * either side of midnight whatever the offset resolves to.
 */
export function formatEventLongDate(locale: string, date: string): string {
  return new Intl.DateTimeFormat(DATE_TAG[locale] ?? "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Warsaw",
  }).format(new Date(`${date}T12:00:00+02:00`));
}

/**
 * Day + month without the year — "8 August" / "8 sierpnia" / "8 серпня" — for
 * compact surfaces like the hero's "Next event" stat. Same noon anchoring as
 * {@link formatEventLongDate}.
 */
export function formatEventDayMonth(locale: string, date: string): string {
  return new Intl.DateTimeFormat(DATE_TAG[locale] ?? "en-GB", {
    day: "numeric",
    month: "long",
    timeZone: "Europe/Warsaw",
  }).format(new Date(`${date}T12:00:00+02:00`));
}

/** Format a time stored in hundredths of a second as `MM:SS.cc`. */
export function formatTime(timeCs: number): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const cs = timeCs % 100;
  const totalSec = Math.floor(timeCs / 100);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${pad(minutes)}:${pad(seconds)}.${pad(cs)}`;
}
