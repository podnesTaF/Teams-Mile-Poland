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

import type { EventSummary } from "@/lib/events/types";
import { acceptsIndividuals, acceptsTeams } from "@/lib/events/types";
import { defaultLocale, type Locale } from "@/lib/i18n/config";
import { legalDownloadHref, legalDownloadLocales } from "@/lib/legal/downloads";
import { getDocsForSet, type DocSlug } from "@/lib/legal/manifest";

export type DocumentFormat = "pdf" | "docx";

export type DocumentFile = {
  /** Public path under `/public`. */
  href: string;
  /** Language the file itself is written in — not the reader's locale. */
  lang: Locale;
  /** Shown on the row ("PDF · EN"); `pdf` when omitted. */
  format?: DocumentFormat;
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

/** Attachments shown on every event with an individual path, in render order. */
const INDIVIDUAL: EventDocument[] = [REGULATIONS];

/**
 * The team corpus as downloadable `.docx` files — the published TEAM MILE
 * documents (`LEGAL_DOCS`, set `team`) in publication order, each in the three
 * app locales. Built from the manifest so a document added there appears here
 * without a second list; the Statement is left out because it is the form a
 * member signs on the confirmation screen, not a document to read beforehand,
 * and a document whose source files are absent is left out rather than linked
 * to a 404. Labels resolve under `events.docs.items.<slug>`.
 */
function teamDocuments(): EventDocument[] {
  return getDocsForSet("team")
    .filter((doc) => !doc.personalised)
    .flatMap((doc) => {
      const present = legalDownloadLocales(doc);
      if (present.length === 0) return [];
      return [
        {
          id: doc.slug,
          labelKey: doc.slug,
          files: Object.fromEntries(
            present.map((lang) => [
              lang,
              { href: legalDownloadHref(doc.slug as DocSlug, lang), lang, format: "docx" as const },
            ]),
          ) as Partial<Record<Locale, DocumentFile>>,
        },
      ];
    });
}

/**
 * Documents for one event: the individual regulations on nights with an
 * individual path, the team corpus on nights with a team path — a mixed night
 * lists both (ADR 0009).
 */
export function getEventDocuments(event: EventSummary): EventDocument[] {
  return [
    ...(acceptsIndividuals(event) ? INDIVIDUAL : []),
    ...(acceptsTeams(event) ? teamDocuments() : []),
  ];
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
