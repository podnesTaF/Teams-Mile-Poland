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

/* The admin panel's token set is dropped from the DS theme (ADR 0004: the
 * `admin-*` colors are declared on `.admin-root` in src/app/admin.css and are
 * only in scope under /admin). Two reasons it cannot ship here:
 *
 *   - admin.css is not part of the bundle, so every `text-admin-ink` /
 *     `border-admin-line` utility Tailwind emits from the app's own /admin
 *     pages carries a var() that resolves to nothing in a design. Those were
 *     the [TOKENS_MISSING] warns.
 *   - `rounded-admin` (6px) and `rounded-admin-lg` (10px) contradict the
 *     design language this system documents, where every radius is 2px.
 *
 * Trimming the theme rather than the `content` globs is deliberate: it makes
 * the utilities unemittable whatever gets scanned. (Excluding the paths does
 * not work anyway — the same classes come from src/app/[locale]/admin/**.)
 */
const baseExtend = (base.theme?.extend ?? {}) as Record<string, any>;
const { admin: _adminColors, ...colors } = (baseExtend.colors ?? {}) as Record<string, unknown>;
const {
  admin: _adminRadius,
  "admin-lg": _adminRadiusLg,
  ...borderRadius
} = (baseExtend.borderRadius ?? {}) as Record<string, unknown>;

const config: Config = {
  ...base,
  theme: {
    ...base.theme,
    extend: { ...baseExtend, colors, borderRadius },
  },
  content: {
    files: [
      "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
      "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
      "./src/features/**/*.{js,ts,jsx,tsx,mdx}",
      /* The theme trim above cannot stop *arbitrary* values, and the admin
         shell writes several — `top-[var(--admin-topbar-h)]`,
         `shadow-[inset_3px_0_0_var(--admin-accent)]`. admin.css is not
         shipped, so those resolve to nothing in a design. Every such usage in
         the repo is under src/features/admin (checked), so excluding it here
         clears the rest of [TOKENS_MISSING]. */
      "!./src/features/admin/**",
      "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
      ...raw,
    ],
  },
};

export default config;
