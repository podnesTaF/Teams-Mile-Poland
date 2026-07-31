/* Builds the design system's stylesheet.
 *
 * Two steps:
 *   1. Generate ds-classlist.txt — the utility surface the shipped
 *      stylesheet must contain.
 *   2. Run the app's Tailwind over ds-input.css with that file added
 *      to `content`.
 *
 * Why the class list exists: the app's build tree-shakes Tailwind to
 * the classes the repo literally uses. That is right for the app and
 * wrong for a design system, because the claude.ai/design agent
 * writes new markup — any utility the repo happens not to use today
 * would be missing from the shipped CSS and its designs would render
 * broken. Listing the classes in a scanned file (rather than using
 * `safelist`) is deliberate: Tailwind v3's `safelist[].variants` does
 * not emit breakpoint-prefixed classes, but the content scanner
 * handles `md:` / `hover:` prefixes natively.
 *
 * Every value below comes from the app's own tailwind.config.ts
 * theme. This adds no new design decisions — it only stops the
 * app's own scale from being tree-shaken away.
 *
 * Usage: node .design-sync/css/build-css.mjs
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../..");

const SPACING = [
  "0", "0.5", "1", "1.5", "2", "2.5", "3", "3.5", "4", "5", "6", "7", "8", "9",
  "10", "11", "12", "14", "16", "20", "24", "28", "32", "40", "48", "56", "64", "px",
];
const SCREENS = ["sm", "md", "lg", "xl"];
const STATES = ["hover", "focus", "focus-visible", "active", "disabled", "group-hover"];

// The app's token palette (tailwind.config.ts → theme.extend.colors).
const TOKEN_COLORS = [
  "bg", "bg-2", "bg-3", "ink", "ink-2", "muted", "muted-2", "line", "line-2",
  "accent", "accent-hot", "accent-soft", "success", "warning",
  "brand-red", "brand-red-hot", "brand-black", "brand-white",
  "transparent", "current", "inherit", "white", "black",
];
const NEUTRALS = ["neutral", "red", "green", "amber", "zinc", "stone"];
const SHADES = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"];

const cross = (prefixes, names) =>
  names.flatMap((n) => [n, ...prefixes.map((p) => `${p}:${n}`)]);

/* --- responsive: layout, spacing, sizing, type --- */
const responsive = [
  // display / flex / grid
  "flex", "inline-flex", "grid", "inline-grid", "block", "inline-block", "inline",
  "hidden", "contents", "table",
  "flex-row", "flex-col", "flex-row-reverse", "flex-col-reverse", "flex-wrap",
  "flex-nowrap", "flex-1", "flex-auto", "flex-initial", "flex-none",
  "shrink", "shrink-0", "grow", "grow-0",
  ...["start", "end", "center", "baseline", "stretch"].flatMap((v) => [`items-${v}`, `self-${v}`]),
  ...["start", "end", "center", "between", "around", "evenly", "stretch"].flatMap((v) => [
    `justify-${v}`, `content-${v}`,
  ]),
  ...Array.from({ length: 12 }, (_, i) => `grid-cols-${i + 1}`), "grid-cols-none",
  ...Array.from({ length: 6 }, (_, i) => `grid-rows-${i + 1}`),
  ...Array.from({ length: 12 }, (_, i) => `col-span-${i + 1}`), "col-span-full",
  ...Array.from({ length: 6 }, (_, i) => `row-span-${i + 1}`), "row-span-full",
  ...["1", "2", "3", "4", "5", "6", "first", "last", "none"].map((v) => `order-${v}`),
  // spacing
  ...["p", "px", "py", "pt", "pr", "pb", "pl"].flatMap((p) => SPACING.map((s) => `${p}-${s}`)),
  ...["m", "mx", "my", "mt", "mr", "mb", "ml"].flatMap((p) => SPACING.map((s) => `${p}-${s}`)),
  ...["mx-auto", "my-auto", "mt-auto", "mb-auto", "ml-auto", "mr-auto"],
  ...["gap", "gap-x", "gap-y"].flatMap((p) => SPACING.map((s) => `${p}-${s}`)),
  ...["space-x", "space-y"].flatMap((p) => SPACING.map((s) => `${p}-${s}`)),
  // sizing
  ...["full", "screen", "auto", "min", "max", "fit", "1/2", "1/3", "2/3", "1/4", "3/4", "1/5", "4/5"]
    .map((v) => `w-${v}`),
  ...SPACING.map((s) => `w-${s}`),
  ...["full", "screen", "auto", "min", "max", "fit"].map((v) => `h-${v}`),
  ...SPACING.map((s) => `h-${s}`),
  ...["0", "none", "full", "min", "max", "fit", "xs", "sm", "md", "lg", "xl", "2xl", "3xl",
    "4xl", "5xl", "6xl", "7xl", "container", "prose"].flatMap((v) => [`max-w-${v}`, `min-w-${v}`]),
  ...["0", "none", "full", "screen", "min", "max", "fit"].flatMap((v) => [`max-h-${v}`, `min-h-${v}`]),
  // typography
  ...["xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl", "5xl", "6xl", "7xl", "eyebrow"]
    .map((v) => `text-${v}`),
  ...["display", "display-alt", "sans", "mono"].map((v) => `font-${v}`),
  ...["thin", "light", "normal", "medium", "semibold", "bold", "extrabold", "black"]
    .map((v) => `font-${v}`),
  ...["left", "center", "right", "justify"].map((v) => `text-${v}`),
  ...["none", "tight", "snug", "normal", "relaxed", "loose", "3", "4", "5", "6", "7", "8", "9", "10"]
    .map((v) => `leading-${v}`),
  ...["tighter", "tight", "normal", "wide", "wider", "widest"].map((v) => `tracking-${v}`),
  "italic", "not-italic", "underline", "line-through", "no-underline", "truncate",
  "uppercase", "lowercase", "capitalize", "normal-case",
  // borders / radii / position / overflow
  ...["border", "border-x", "border-y", "border-t", "border-r", "border-b", "border-l"]
    .flatMap((p) => [p, `${p}-0`, `${p}-2`, `${p}-4`, `${p}-8`]),
  "rounded", "rounded-none", "rounded-sm", "rounded-md", "rounded-lg", "rounded-pill", "rounded-full",
  "static", "fixed", "absolute", "relative", "sticky",
  ...["inset", "inset-x", "inset-y", "top", "right", "bottom", "left"].flatMap((p) =>
    ["0", "auto", "full", "1/2", "px", "1", "2", "3", "4", "6", "8"].map((v) => `${p}-${v}`)),
  ...["auto", "hidden", "visible", "scroll", "x-auto", "y-auto", "x-hidden", "y-hidden"]
    .map((v) => `overflow-${v}`),
];

/* --- stateful: colour and feedback --- */
const stateful = [
  ...["bg", "text", "border", "ring", "fill", "stroke", "decoration", "divide", "placeholder"]
    .flatMap((p) => TOKEN_COLORS.map((c) => `${p}-${c}`)),
  ...["bg", "text", "border"].flatMap((p) =>
    NEUTRALS.flatMap((n) => SHADES.map((s) => `${p}-${n}-${s}`))),
  ...["0", "5", "10", "20", "25", "30", "40", "50", "60", "70", "75", "80", "90", "95", "100"]
    .map((v) => `opacity-${v}`),
  "shadow", "shadow-sm", "shadow-lg", "shadow-none",
  "ring", "ring-0", "ring-1", "ring-2", "ring-4", "ring-8", "ring-inset",
  "underline", "no-underline",
];

/* --- plain: no variants needed --- */
const plain = [
  ...["contain", "cover", "fill", "none", "scale-down"].map((v) => `object-${v}`),
  ...["0", "10", "20", "30", "40", "50", "auto"].map((v) => `z-${v}`),
  ...["divide-x", "divide-y"].flatMap((p) => [p, `${p}-0`, `${p}-2`, `${p}-4`, `${p}-8`]),
  "cursor-pointer", "cursor-default", "cursor-not-allowed", "cursor-wait",
  "pointer-events-none", "pointer-events-auto", "select-none", "resize-none",
  "appearance-none", "whitespace-normal", "whitespace-nowrap", "whitespace-pre",
  "whitespace-pre-line", "whitespace-pre-wrap", "break-words", "break-all", "tabular-nums",
  "transition", "transition-all", "transition-colors", "transition-opacity", "transition-transform",
  ...["75", "100", "150", "200", "300", "500", "700", "1000"].map((v) => `duration-${v}`),
  ...["linear", "in", "out", "in-out", "snappy"].map((v) => `ease-${v}`),
  "animate-none", "animate-spin", "animate-pulse-slow",
  "sr-only", "not-sr-only", "antialiased", "list-none", "list-disc", "list-decimal",
  "container", "aspect-square", "aspect-video",
];

/* --- the app's own semantic classes ---
 *
 * globals.css defines .shout, .eyebrow, .modal-*, .ff-*, .cbx and friends
 * inside `@layer` blocks, which makes them subject to the same tree-shaking as
 * utilities: any one the repo does not currently reference is dropped. That is
 * wrong for a design system — .shout-xl and .shout-sm are real parts of the
 * type scale that happen to be unused today, and a design agent reaching for
 * one would get nothing.
 *
 * Scraped from the stylesheet rather than listed by hand so a class added to
 * globals.css can never be silently purged. (landing.css needs no equivalent:
 * it is plain CSS outside any @layer, so Tailwind leaves it alone.) */
const semanticFrom = (file) => {
  const css = readFileSync(resolve(repoRoot, file), "utf8");
  return [...css.matchAll(/\.(-?[A-Za-z_][\w-]*)/g)].map((m) => m[1]);
};
const semantic = semanticFrom("src/app/globals.css");

const classes = [
  ...cross(SCREENS, responsive),
  ...cross(STATES, stateful),
  ...plain,
  ...semantic,
];
const unique = [...new Set(classes)];

// One class per line: Tailwind's extractor treats each as a candidate.
const listPath = resolve(here, "ds-classlist.txt");
writeFileSync(listPath, unique.join("\n") + "\n");
console.log(`ds-classlist.txt: ${unique.length} classes`);

// shell: true — on Windows the npx shim is a .cmd, which execFileSync
// cannot spawn directly.
// Output lands inside .design-sync/pkg/ because the converter bounds
// cfg.cssEntry to the package directory.
execFileSync(
  "npx tailwindcss" +
    " -c .design-sync/css/tailwind.ds.config.ts" +
    " -i .design-sync/css/ds-input.css" +
    " -o .design-sync/pkg/ds-compiled.css",
  { cwd: repoRoot, stdio: "inherit", shell: true },
);
