/**
 * Reading the legal corpus off disk.
 *
 * The documents are plain HTML files, not message keys and not a database:
 * `src/content/legal/<locale>/<slug>.html`. The filename **is** the manifest
 * slug — team documents carry their `team-` prefix in the name — so there is no
 * mapping table to keep in step, and `git log` on a path is the version history
 * of exactly one document in exactly one language.
 *
 * Server-only: uses `node:fs`. Never import it from a `"use client"` component.
 * Imports stay relative so `scripts/check-legal-manifest.ts` can load it under
 * `tsx` — see the note at the top of `manifest.ts`.
 */

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { type DocLocale, type LegalDoc } from "./manifest";

/** Where the corpus lives, relative to the project root. */
export const LEGAL_CONTENT_DIR = path.join("src", "content", "legal");

/** The locale a missing translation falls back to. Also the language of record. */
export const FALLBACK_DOC_LOCALE: DocLocale = "pl";

/**
 * Absolute path of one document file. `process.cwd()` is the project root for
 * `next build`, `next start` and `npx tsx` alike.
 */
export function legalDocPath(locale: DocLocale, slug: string): string {
  return path.join(process.cwd(), LEGAL_CONTENT_DIR, locale, `${slug}.html`);
}

/** sha256 of a file's bytes, hex — the value the manifest stores. */
export function hashFile(filePath: string): string {
  return createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

export type LoadedLegalDoc = {
  /** Raw document HTML, tokens still in place. Run it through `fillLegalTokens`. */
  html: string;
  /** The language the returned bytes are actually written in. */
  lang: DocLocale;
  /** True when `lang` is not the locale asked for — show the fallback notice. */
  usedFallback: boolean;
};

/**
 * Load a registered document in the reader's language.
 *
 * A signable document is registered in all three locales — the build guard makes
 * sure of it — so the fallback arm can only ever fire for a read-only appendix.
 * That asymmetry is the whole point: nobody is asked to accept a document in a
 * language they did not choose (PRD cross-cutting decision 1), while an appendix
 * that has not been translated yet is still readable in Polish with a notice
 * saying so.
 *
 * Throws when the file the manifest names is absent. That is unreachable in a
 * built app (the guard fails the build first) and a loud failure is right for the
 * case where it is not: silently rendering an empty legal document is worse.
 */
export function loadLegalDoc(doc: LegalDoc, locale: DocLocale): LoadedLegalDoc {
  const lang: DocLocale = doc.locales[locale] ? locale : FALLBACK_DOC_LOCALE;
  return {
    html: fs.readFileSync(legalDocPath(lang, doc.slug), "utf8"),
    lang,
    usedFallback: lang !== locale,
  };
}
