/**
 * Files attached to an event's detail page.
 *
 * Phase 1 is deliberately static: every individual event shares the same
 * regulations PDF, translated per locale, so there is nothing to configure per
 * event and nothing to upload. `getEventDocuments(slug)` is the seam — when an
 * event needs its own attachments, give it an entry in `PER_EVENT` (or later,
 * a `documents` field on the registry row / a DB table) and the detail page
 * renders it without changing.
 *
 * A document carries one file per locale. Missing locales fall back to
 * `defaultLocale` so a runner always gets *a* file; the page marks that case so
 * it reads "PDF · PL" rather than pretending the download is translated.
 */

import { defaultLocale, type Locale } from "@/lib/i18n/config";

export type DocumentFile = {
  /** Public path under `/public`. */
  href: string;
  /** Language the file itself is written in — not the reader's locale. */
  lang: Locale;
};

export type EventDocument = {
  id: string;
  /** Resolves under the `events.docs.items` i18n namespace. */
  labelKey: string;
  files: Partial<Record<Locale, DocumentFile>>;
};

const REGULATIONS: EventDocument = {
  id: "regulations",
  labelKey: "regulations",
  files: {
    en: { href: "/docs/event-regulations.en.pdf", lang: "en" },
    pl: { href: "/docs/event-regulations.pl.pdf", lang: "pl" },
    ua: { href: "/docs/event-regulations.ua.pdf", lang: "ua" },
  },
};

/** Attachments shown on every individual event, in render order. */
const SHARED: EventDocument[] = [REGULATIONS];

/** Documents for one event. `slug` is unused while every event shares `SHARED`. */
export function getEventDocuments(_slug: string): EventDocument[] {
  return SHARED;
}

/**
 * The file a reader in `locale` should get, plus whether it is a fallback in
 * another language. Returns `null` for a document with no files at all.
 */
export function resolveDocumentFile(
  doc: EventDocument,
  locale: Locale,
): { file: DocumentFile; isFallback: boolean } | null {
  const file = doc.files[locale] ?? doc.files[defaultLocale] ?? Object.values(doc.files)[0];
  if (!file) return null;
  return { file, isFallback: file.lang !== locale };
}
