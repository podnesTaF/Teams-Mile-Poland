/* Prepares the design-system package the converter consumes.
 *
 * Run this before package-build.mjs (it is cfg.buildCmd):
 *
 *   node .design-sync/build.mjs
 *
 * Two outputs, both under .design-sync/pkg/:
 *   types/**  — real .d.ts emitted by tsc from the app's own components.
 *               These become each component's <Name>Props contract, which
 *               is what the claude.ai/design agent codes against, so they
 *               are worth emitting properly rather than hand-writing.
 *   ds-compiled.css — the compiled stylesheet (see css/build-css.mjs).
 *
 * Nothing here copies or rewrites component source. The barrel in pkg/
 * re-exports src/components/ui as-is.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const pkgDir = join(here, "pkg");
const typesDir = join(pkgDir, "types");

const run = (cmd, cwd) => execFileSync(cmd, { cwd, stdio: "inherit", shell: true });

// ── 1. type declarations ────────────────────────────────────────────────
rmSync(typesDir, { recursive: true, force: true });
run("npx tsc -p tsconfig.dts.json", pkgDir);

/* tsc puts the barrel's own declaration at types/.design-sync/pkg/index.d.ts,
 * because the common root of the barrel and the components it re-exports is
 * the repo root. Two problems with leaving it there: package.json would have
 * to point `types` into a dot-directory, and the converter globs the types
 * root with fast-glob, which skips dot-segments by default — the glob would
 * silently match nothing. So hoist it to types/index.d.ts and fix up the
 * now-shorter relative specifiers. */
const nested = join(typesDir, ".design-sync", "pkg", "index.d.ts");
const hoisted = join(typesDir, "index.d.ts");
if (!existsSync(nested)) {
  console.error(`✗ expected tsc to emit ${nested} — did the barrel or rootDir change?`);
  process.exit(1);
}
writeFileSync(
  hoisted,
  readFileSync(nested, "utf8").replace(/(["'])\.\.\/\.\.\/src\//g, "$1./src/"),
);
rmSync(join(typesDir, ".design-sync"), { recursive: true, force: true });

const emitted = readFileSync(hoisted, "utf8");
if (/\.\.\/\.\.\//.test(emitted)) {
  console.error("✗ index.d.ts still has out-of-tree specifiers after hoisting:\n" + emitted);
  process.exit(1);
}
const reexports = (emitted.match(/^export \* from/gm) ?? []).length;
console.log(`types/index.d.ts: ${reexports} module re-exports`);

// ── 2. stylesheet ───────────────────────────────────────────────────────
run("node .design-sync/css/build-css.mjs", repoRoot);
