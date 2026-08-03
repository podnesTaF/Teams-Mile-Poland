/* Tailwind config for the design-system bundle only.
 *
 * Extends the app's tailwind.config.ts without modifying it — the
 * theme (colors, fonts, radii, shadows, easings) is entirely the
 * app's own. The only difference is `content`.
 *
 * ds-classlist.txt and the authored previews are passed as `raw`
 * content rather than as glob patterns on purpose: they live under
 * `.design-sync/`, and Tailwind globs via fast-glob with `dot: false`,
 * so every path under a dot-directory is silently skipped. A glob
 * there compiles without error and simply contributes nothing, which
 * is the failure mode this avoids. See build-css.mjs for why the
 * class list exists at all.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { Config } from "tailwindcss";
import base from "../../tailwind.config";

// Resolved from cwd, not import.meta.url: Tailwind loads this TS config
// through jiti, which transpiles to CJS where import.meta.url is not
// available. build-css.mjs always invokes Tailwind from the repo root.
const repoRoot = process.cwd();
const listFile = join(repoRoot, ".design-sync", "css", "ds-classlist.txt");
const previewDir = join(repoRoot, ".design-sync", "previews");

const raw: Array<{ raw: string; extension: string }> = [];

if (existsSync(listFile)) {
  raw.push({ raw: readFileSync(listFile, "utf8"), extension: "html" });
}

// Authored preview cards style their own layout glue with utilities.
if (existsSync(previewDir)) {
  for (const f of readdirSync(previewDir)) {
    if (f.endsWith(".tsx") || f.endsWith(".ts")) {
      raw.push({ raw: readFileSync(join(previewDir, f), "utf8"), extension: "tsx" });
    }
  }
}

const config: Config = {
  ...base,
  content: {
    files: [
      "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
      "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
      "./src/features/**/*.{js,ts,jsx,tsx,mdx}",
      "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
      ...raw,
    ],
  },
};

export default config;
