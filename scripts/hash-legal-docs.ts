/**
 * Recompute the legal manifest's sha256 values after a document is *deliberately*
 * re-issued.
 *
 *   npm run legal:hash              # report only — what would change
 *   npm run legal:hash -- --write   # rewrite the hashes in src/lib/legal/manifest.ts
 *
 * The build guard (`scripts/check-legal-manifest.ts`) exists to catch a pandoc
 * rerun that silently wiped the hand-placed `__TOKEN__` fills, so this script is
 * the deliberate override and nothing else: run it only when the new bytes have
 * been eyeballed and the document's `version` bumped by hand. It never touches
 * `version`, and it prints a reminder for every document it rewrites.
 *
 * `--write` replaces the stale 64-hex string with the fresh one by exact string
 * substitution. Hashes are unique inside the file, so the edit cannot land
 * anywhere but the intended entry, and nothing else about the manifest is
 * reformatted.
 */
import fs from "node:fs";
import path from "node:path";

import { hashFile, legalDocPath } from "../src/lib/legal/content";
import { type DocLocale, LEGAL_DOCS } from "../src/lib/legal/manifest";

const MANIFEST = path.join("src", "lib", "legal", "manifest.ts");
const LOCALES: readonly DocLocale[] = ["pl", "en", "ua"];

async function main() {
  const write = process.argv.includes("--write");
  const stale: { slug: string; locale: DocLocale; from: string; to: string }[] = [];
  const missing: string[] = [];

  for (const doc of LEGAL_DOCS) {
    for (const locale of LOCALES) {
      const entry = doc.locales[locale];
      if (!entry) continue;
      const file = legalDocPath(locale, doc.slug);
      if (!fs.existsSync(file)) {
        missing.push(`${locale}/${doc.slug}.html`);
        continue;
      }
      const actual = hashFile(file);
      if (actual !== entry.sha256) {
        stale.push({ slug: doc.slug, locale, from: entry.sha256, to: actual });
      }
    }
  }

  for (const file of missing) {
    console.error(`[legal] missing file for a registered entry: ${file}`);
  }

  if (stale.length === 0) {
    console.log("[legal] every registered hash already matches the file on disk.");
    if (missing.length > 0) process.exitCode = 1;
    return;
  }

  for (const s of stale) {
    console.log(`[legal] ${s.locale}/${s.slug}.html\n         ${s.from}\n      -> ${s.to}`);
  }

  if (!write) {
    console.log(
      `\n[legal] ${stale.length} hash(es) out of date. Re-run with --write to update ` +
        `${MANIFEST}, and bump the affected documents' \`version\` by hand.`,
    );
    return;
  }

  let source = fs.readFileSync(MANIFEST, "utf8");
  for (const s of stale) {
    if (!source.includes(s.from)) {
      console.error(`[legal] could not find ${s.from} in ${MANIFEST}; nothing written.`);
      process.exitCode = 1;
      return;
    }
    source = source.split(s.from).join(s.to);
  }
  fs.writeFileSync(MANIFEST, source);

  const slugs = [...new Set(stale.map((s) => s.slug))];
  console.log(
    `\n[legal] wrote ${stale.length} hash(es) to ${MANIFEST}.\n` +
      `[legal] now bump \`version\` by hand for: ${slugs.join(", ")} — a consent row ` +
      `stores that string, so re-issued text under an unchanged version is unprovable.`,
  );
}

main().catch((error) => {
  console.error("[legal] hash update crashed:", error);
  process.exitCode = 1;
});
