/**
 * The approved `.docx` sources of the published legal corpus, offered for
 * download next to the HTML rendering.
 *
 * Files live under `public/docs/legal/<locale>/<slug>.docx` — the same
 * locale/slug layout as the HTML in `src/content/legal`, so the file for a
 * document in a language is a path computation, not a lookup table to keep in
 * step. Only *published* documents (those in `LEGAL_DOCS`) are offered; the
 * organiser-internal papers (Załącznik 2, LIA, its acknowledgement, the Team
 * Captain provisions) sit in the same folders, unlinked, exactly like their
 * HTML (see `src/content/legal/README.md`).
 *
 * Not every published document has its source here: the individual set
 * (Oświadczenie, Przepisy, RODO) was imported from the reference module's HTML
 * and its `.docx` files were never supplied, so those pages show no download.
 * Which documents are offered is the static list {@link DOWNLOADABLE_DOCS} —
 * not a disk probe, because a page rendered on demand in a serverless function
 * does not have `public/` beside it — and the build guard
 * (`src/lib/legal/check.ts`) holds the list to the disk: every registered
 * locale of a listed document must have its file, and no unlisted document may
 * have one, so a reader is never handed a file in a language they did not
 * choose while their neighbour gets their own.
 */

import type { DocLocale, DocSlug, LegalDoc } from "./manifest";

/**
 * The published documents whose approved `.docx` is in the repository, in
 * every registered locale. Add a slug here when its files land under
 * `public/docs/legal/<locale>/<slug>.docx`; `npm run legal:check` says which
 * are missing.
 */
export const DOWNLOADABLE_DOCS: readonly DocSlug[] = [
  "team-regulations",
  "team-rules",
  "team-rodo",
  "team-oswiadczenie",
  "team-appendix1",
  "team-appendix3",
  "team-appendix4",
  "team-appendix5",
];

/** Public URL path prefix and on-disk folder (under `public/`). */
export const LEGAL_DOWNLOADS_DIR = "docs/legal";

/** The public URL of a document's `.docx` in a locale. */
export function legalDownloadHref(slug: DocSlug, locale: DocLocale): string {
  return `/${LEGAL_DOWNLOADS_DIR}/${locale}/${slug}.docx`;
}

/** Repo-relative disk path of that file, forward slashes. */
export function legalDownloadPath(slug: DocSlug, locale: DocLocale): string {
  return `public${legalDownloadHref(slug, locale)}`;
}

/** The locales a document is offered for download in: all registered ones, or none. */
export function legalDownloadLocales(doc: LegalDoc): DocLocale[] {
  return DOWNLOADABLE_DOCS.includes(doc.slug) ? (Object.keys(doc.locales) as DocLocale[]) : [];
}

export type LegalDownload = {
  href: string;
  /** Language of the file itself — not the reader's locale. */
  lang: DocLocale;
  /** True when the reader's language has no file and another was offered. */
  isFallback: boolean;
};

/**
 * The download a reader in `locale` should get: their language when the file
 * exists, otherwise the same fallback order the HTML rendering uses (Polish,
 * the source of record, then anything present). `null` when the document is
 * not in {@link DOWNLOADABLE_DOCS} — the page then simply shows no download.
 */
export function resolveLegalDownload(doc: LegalDoc, locale: DocLocale): LegalDownload | null {
  const present = legalDownloadLocales(doc);
  const lang = present.includes(locale) ? locale : present.includes("pl") ? "pl" : present[0];
  if (!lang) return null;
  return { href: legalDownloadHref(doc.slug, lang), lang, isFallback: lang !== locale };
}
