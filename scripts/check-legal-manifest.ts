/**
 * Build guard for the legal corpus. Runs as the first half of `npm run build`,
 * so it runs locally and on Vercel alike, before Next.js compiles anything.
 *
 *   npx tsx scripts/check-legal-manifest.ts
 *
 * Fails with exit code 1, naming every offending file, when a registered
 * document's bytes no longer match its manifest sha256 or a signable document is
 * missing a pl/en/ua translation. See `src/lib/legal/check.ts` for why each of
 * those has to be fatal rather than a warning.
 *
 * Unlike the fixture scripts in this folder it touches no database, sends no
 * mail and needs no environment — it reads files and compares hashes.
 */
import {
  checkLegalManifest,
  formatLegalManifestProblems,
} from "../src/lib/legal/check";
import { LEGAL_DOCS } from "../src/lib/legal/manifest";

async function main() {
  const problems = checkLegalManifest();

  if (problems.length === 0) {
    const files = LEGAL_DOCS.reduce((n, d) => n + Object.keys(d.locales).length, 0);
    console.log(
      `[legal] manifest OK — ${LEGAL_DOCS.length} documents, ${files} files verified.`,
    );
    return;
  }

  console.error(
    `\n[legal] BUILD FAILED — the legal corpus does not match src/lib/legal/manifest.ts.\n` +
      `${problems.length} problem${problems.length === 1 ? "" : "s"}:\n\n` +
      `${formatLegalManifestProblems(problems)}\n`,
  );
  process.exitCode = 1;
}

main().catch((error) => {
  console.error("[legal] manifest check crashed:", error);
  process.exitCode = 1;
});
