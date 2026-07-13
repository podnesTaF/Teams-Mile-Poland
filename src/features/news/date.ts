/** BCP-47 tag per app locale for `Intl.DateTimeFormat` (mirrors the event page). */
const DATE_TAG: Record<string, string> = { en: "en-GB", pl: "pl-PL", ua: "uk-UA" };

/**
 * A published article's display date — the long localized form (e.g. "3 August
 * 2026"), pinned to Europe/Warsaw so the date reads the same regardless of where
 * the page is rendered or cached.
 */
export function formatNewsDate(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(DATE_TAG[locale] ?? "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Warsaw",
  }).format(date);
}
