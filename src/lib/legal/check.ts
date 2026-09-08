/**
 * The manifest guard: does the corpus on disk still match what the manifest
 * vouches for?
 *
 * Two failures, both fatal to `npm run build` (`scripts/check-legal-manifest.ts`):
 *
 *  1. **Byte drift.** A registered file's sha256 no longer matches the manifest.
 *     This is the one the feature exists for — rerunning pandoc over an updated
 *     `.docx` restores the original text, which means the hand-placed fill tokens
 *     are gone and a date hardcoded to one race night is back. Nothing else in
 *     the build would notice: the page still renders, it just renders the wrong
 *     night's date and prints `__FULL_NAME__`-shaped holes as literal prose.
 *  2. **A signable document missing a translation.** Accepting a document one
 *     cannot read is the defect this whole feature exists to prevent, so a
 *     missing `pl`/`en`/`ua` file fails the build rather than falling back
 *     (PRD cross-cutting decision 1). Read-only appendices are exempt: they fall
 *     back to Polish with a notice.
 *  3. **An `eventless` document that still contains a fill token.** The flag
 *     claims the text names no race night, and `/[locale]/legal/[doc]` serves it
 *     with no event and therefore no values: a surviving `__EVENT_DATE__` would
 *     reach the reader as literal prose. Same accident as (1) — a pandoc rerun
 *     over a re-issued `.docx` reintroducing a token — so the same remedy, but
 *     it needs saying separately because a *deliberate* re-issue that adds a
 *     token would be hashed happily by `npm run legal:hash -- --write` and only
 *     this check would notice the document is no longer event-independent.
 *
 * A missing *file* for a registered locale is reported as drift too — it is the
 * same class of accident (a regeneration that dropped a language) and the same
 * remedy.
 *
 * Pure and dependency-free apart from `node:fs`, so the script can run it under
 * `tsx` before Next.js starts. Imports stay relative for the same reason.
 */

import fs from "node:fs";

import { hashFile, legalDocPath, LEGAL_CONTENT_DIR } from "./content";
import { LEGAL_TOKENS } from "./fill";
import { type DocLocale, LEGAL_DOCS } from "./manifest";

/** The three locales every signable document must ship in. */
const REQUIRED_LOCALES: readonly DocLocale[] = ["pl", "en", "ua"];

/**
 * Every `__TOKEN__` the corpus knows about, straight from the filler so the two
 * cannot drift: a token added to `fill.ts` is a token this guard rejects in an
 * `eventless` document from the same commit.
 */
const FILL_TOKENS: readonly string[] = Object.keys(LEGAL_TOKENS);

export type LegalManifestProblem = {
  /** Repo-relative path of the offending file — always named, so the fix is obvious. */
  file: string;
  slug: string;
  locale: DocLocale;
  reason: "missing-file" | "missing-translation" | "hash-mismatch" | "eventless-token";
  detail: string;
};

/** Repo-relative path, forward slashes, for messages that must read the same on Windows and Linux. */
function repoPath(locale: DocLocale, slug: string): string {
  return `${LEGAL_CONTENT_DIR.split(/[\\/]/).join("/")}/${locale}/${slug}.html`;
}

/**
 * Check every registered document against disk. Returns the problems found, in
 * manifest order; an empty array means the corpus is intact.
 */
export function checkLegalManifest(): LegalManifestProblem[] {
  const problems: LegalManifestProblem[] = [];

  for (const doc of LEGAL_DOCS) {
    // 2. A signable document must declare all three locales. The manifest type
    // already forces this for signable docs, so this catches the case the
    // compiler cannot: a declared locale whose file was deleted is handled
    // below, but a *non*-signable doc promoted to signable in a hand edit that
    // skipped `npm run typecheck` would land here.
    if (doc.signable) {
      for (const locale of REQUIRED_LOCALES) {
        if (!doc.locales[locale]) {
          problems.push({
            file: repoPath(locale, doc.slug),
            slug: doc.slug,
            locale,
            reason: "missing-translation",
            detail:
              `signable document "${doc.slug}" declares no ${locale} translation. ` +
              `Signable documents must ship in pl, en and ua — nobody may be asked ` +
              `to accept a document in a language they did not choose.`,
          });
        }
      }
    }

    // 1. Declared bytes must still be the bytes on disk.
    for (const locale of REQUIRED_LOCALES) {
      const entry = doc.locales[locale];
      if (!entry) continue; // a read-only doc that legitimately has no translation
      const absolute = legalDocPath(locale, doc.slug);
      if (!fs.existsSync(absolute)) {
        problems.push({
          file: repoPath(locale, doc.slug),
          slug: doc.slug,
          locale,
          reason: "missing-file",
          detail:
            `the manifest registers this file but it does not exist. Restore it, ` +
            `or remove the ${locale} entry for "${doc.slug}" from src/lib/legal/manifest.ts.`,
        });
        continue;
      }
      const actual = hashFile(absolute);
      if (actual !== entry.sha256) {
        problems.push({
          file: repoPath(locale, doc.slug),
          slug: doc.slug,
          locale,
          reason: "hash-mismatch",
          detail:
            `bytes changed: manifest says sha256 ${entry.sha256}, file is ${actual}. ` +
            `If the document was re-issued on purpose, bump "${doc.slug}"'s version ` +
            `and run \`npm run legal:hash -- --write\`. If you did not mean to change ` +
            `it, a pandoc rerun has almost certainly wiped the __TOKEN__ fills — ` +
            `restore the file from git.`,
        });
      }

      // 3. An `eventless` document is served with no event and no consent
      // record behind it, so there is nothing a token could be filled from.
      if (!doc.eventless) continue;
      const text = fs.readFileSync(absolute, "utf8");
      const found = FILL_TOKENS.filter((token) => text.includes(token));
      if (found.length > 0) {
        problems.push({
          file: repoPath(locale, doc.slug),
          slug: doc.slug,
          locale,
          reason: "eventless-token",
          detail:
            `"${doc.slug}" is marked \`eventless\` in src/lib/legal/manifest.ts but this ` +
            `file still contains ${found.join(", ")}. An event-independent document is ` +
            `served at /[locale]/legal/${doc.slug} with no event and no consent record, so ` +
            `the token has nothing to fill it and would print to the reader as literal ` +
            `prose. Either remove the token from the document, or drop \`eventless\` and ` +
            `keep serving it under an event slug.`,
        });
      }
    }
  }

  return problems;
}

/** One human-readable block per problem, ready to print to stderr. */
export function formatLegalManifestProblems(problems: LegalManifestProblem[]): string {
  return problems.map((p) => `  ${p.file}\n    ${p.detail}`).join("\n\n");
}
