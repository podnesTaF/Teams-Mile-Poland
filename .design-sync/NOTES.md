# design-sync notes — Ace Battle Run Design System

Project: https://claude.ai/design/p/871a6906-3091-4703-b1b1-5c2c36c197e4

> The original project (`ab35baf5-…`) was **deleted upstream** and returned 404 on
> the 2026-09-10 re-sync. It was recreated from scratch as "Ace Battle Poland
> Design System" and `cfg.projectId` repointed. Nothing was lost: everything the
> sync needs is committed under `.design-sync/` (previews, docs, css pipeline,
> conventions), so the rebuild was deterministic. What *was* lost is the uploaded
> `_ds_sync.json` anchor, which is why that run re-verified and re-graded all 24
> components instead of carrying them forward.

## What is being synced, and why it looks like this

This repo is a **Next.js 16 app, not a component library**. There is no `dist/`
and no library build, so the sync is built around a small package directory
that exists purely for the converter:

- `.design-sync/pkg/index.ts` — a barrel re-exporting `src/components/ui/*`
  **unchanged**. No copies, no wrappers. `language-switcher` is deliberately
  left out (it reads next-intl's locale context and the Next router, so it can
  never render in a design).
- `.design-sync/pkg/types/` — real `.d.ts` emitted by `tsc` from the app's own
  components. This is what becomes each `<Name>Props` contract, so it is worth
  emitting properly rather than hand-writing.
- `.design-sync/pkg/ds-compiled.css` — the compiled stylesheet.

`node .design-sync/build.mjs` (this is `cfg.buildCmd`) produces both. Run it
before `package-build.mjs`, always.

The scope decision was the user's: import the 24 `src/components/ui` primitives
plus the whole token/type foundation, and **not** `landing/`, `marketing/`, or
`features/`. The landing page is the look they want kept; the rest is what they
want rebuilt from these primitives.

## Converter invocation

```sh
node .design-sync/build.mjs
node .ds-sync/package-build.mjs --config .design-sync/config.json \
  --node-modules ./node_modules --entry .design-sync/pkg/index.ts --out ./ds-bundle
node .ds-sync/package-validate.mjs ./ds-bundle
```

`--entry` is **required** and must stay. Without it the converter computes
`PKG_DIR = node_modules/<pkg>`, which does not exist in the package's own repo.

## Traps that already cost a debugging cycle — do not re-discover these

- **Do NOT create a `node_modules/teams-mile-warshaw` self-symlink/junction** to
  make `PKG_DIR` resolve. It looks like the obvious fix and it kills the build:
  `exportedNames` globs `<PKG_DIR>/**/*.d.ts`, the junction makes that path
  infinitely recursive, and node dies with a 4 GB heap OOM. Use `--entry`.
- **Tailwind never scans anything under `.design-sync/`.** Tailwind globs via
  fast-glob with `dot: false`, so every path inside a dot-directory is silently
  skipped — the glob compiles fine and simply contributes nothing. Both the
  utility class list and the authored previews are therefore passed to
  `content.files` as `{raw, extension}` entries in
  `.design-sync/css/tailwind.ds.config.ts`. If preview utility classes ever
  stop applying, this is the first thing to check.
- **Tailwind v3 `safelist[].variants` does not emit breakpoint-prefixed
  classes.** `{pattern, variants: ['md']}` yields no `md:` output. That is why
  the surface is a generated class list (`css/build-css.mjs` →
  `ds-classlist.txt`) scanned as raw content instead of a safelist.
- **The Tailwind config cannot use `import.meta.url`.** Tailwind loads the TS
  config through jiti, which transpiles to CJS where it is unavailable. Paths in
  that file resolve from `process.cwd()`, and `build-css.mjs` always invokes
  Tailwind from the repo root.
- **`cfg.cssEntry` is bounded to `PKG_DIR`**, which is why the compiled CSS is
  written to `.design-sync/pkg/ds-compiled.css` and not next to its source in
  `.design-sync/css/`. `tsconfig`, `docsDir` and `readmeHeader` are bounded to
  the git repo instead, hence the `../..` style paths in config.

## The next-intl provider (cfg.provider) — do not remove

`PhoneField` calls `useTranslations("common.phone")`. In the app that context
comes from `NextIntlClientProvider` in `src/app/[locale]/layout.tsx`, which no
design ever renders — so outside it the hook **throws** and the card renders as
an empty root (`[RENDER] root empty`, 4 pageerrors, all cells blank). This is
what broke the 2026-09-10 re-sync: the component gained i18n after the previous
sync, and nothing about it fails at build time.

The fix is `cfg.provider` pointing at the real provider, wired through
`.design-sync/pkg/preview-context.tsx` (merged in via `cfg.extraEntries`):

```jsonc
"extraEntries": ["./preview-context.tsx"],
"provider": {
  "component": "NextIntlClientProvider",
  "props": { "locale": "en", "messages": { "$ref": "previewMessages" } }
}
```

Two deliberate choices in that module:

- **`common` is imported as a *named* export** of `src/messages/en.json`, not
  copied. The strings stay sourced from the real file (a copy would rot), and
  the named form lets esbuild drop the other ~20 namespaces — 414 bytes instead
  of 97 KB.
- **Only `common` is exported**, because that is the only namespace the
  `src/components/ui` primitives read today. **A component that starts reading a
  new namespace needs it added there**, or its card renders empty with the same
  signature as above.

`extraEntries` exports do NOT become components (discovery reads the `.d.ts`
tree under `pkg/types`), so this adds bundle exports — 28 now, vs 24
components — without adding a card. That gap is expected, not a miscount.

## Fonts

`src/app/[locale]/layout.tsx` loads six Google families via `next/font` and it
is *that* which injects the `--font-display`, `--font-display-alt`,
`--font-body`, `--font-mono`, `--font-head` and `--font-cta` variables the
stylesheets read. Nothing injects them outside Next, so
`.design-sync/css/fonts.css` reproduces exactly that setup: one remote
`@import` for the six families plus a `:root` block defining the six variables.

**Keep `fonts.css` in sync with `layout.tsx`.** If a family or variable name
changes there and not here, every component silently renders in a fallback face
with the type scale intact — which is easy to miss.

Validate reports `[FONT_REMOTE]` for these six. That is expected and correct,
not a warning to chase.

## Why the CSS is ~750 KB

`ds-input.css` pulls in `globals.css` (tokens, base reset, the `.modal-*` and
`.ff-*` component layers) **and** `landing.css` (the `.ace-landing` design
language, which nearly every non-landing page also imports). On top of that,
`ds-classlist.txt` materialises ~7.8k utility classes.

That last part is deliberate. The app's own build tree-shakes Tailwind to the
classes the repo literally uses, which is right for the app and wrong for a
design system: the design agent writes new markup, and any utility the repo
happens not to use today would be missing from the shipped CSS. Every value in
the list comes from the app's own theme — it adds no new design decisions.

## The admin token set is trimmed out of the DS theme

`tailwind.config.ts` carries an `admin-*` colour set (ADR 0004) whose values are
`var(--admin-*)`, declared on `.ace-landing.admin-root` in `src/app/admin.css`
— a stylesheet this bundle does **not** ship. Left alone, Tailwind emits
`text-admin-ink`, `border-admin-line`, `bg-admin-surface` and friends from the
app's own `/admin` code into the DS stylesheet, where every one of those
`var()`s resolves to nothing. That was `[TOKENS_MISSING] 16 CSS custom
properties` on the 2026-09-10 run.

Clearing it took **two** mechanisms in `css/tailwind.ds.config.ts`, and both are
needed:

1. **Theme trim** — `admin` is destructured out of `theme.extend.colors`, and
   `admin`/`admin-lg` out of `theme.extend.borderRadius`. This makes the *named*
   utilities unemittable no matter what gets scanned. It also makes
   `conventions.md`'s "never round more than 2px" literally true: `rounded-admin`
   (6px) and `rounded-admin-lg` (10px) no longer ship.
2. **Path exclusion** — `"!./src/features/admin/**"` in `content.files`. The
   theme trim cannot stop *arbitrary* values, and the admin shell writes several
   (`top-[var(--admin-topbar-h)]`, `shadow-[inset_3px_0_0_var(--admin-accent)]`).
   Every such usage in the repo is under `src/features/admin` — checked — so
   excluding that one directory clears the remainder.

Do not "simplify" this to one mechanism: dropping either brings admin tokens
back. Result: 0 admin references, and the stylesheet got *smaller*
(791,337 → 781,583 bytes).

**A units trap when checking that number:** the converter logs the stylesheet as
`763 KB` meaning KiB. 791,337 bytes *is* the "773 KB" an earlier log showed —
comparing a byte count from `stat` against the log's KB reads as 18 KB of
phantom growth. Compare like with like.

## Known render warns (checked against this list on re-sync)

- `[FONT_REMOTE]` for the six Google families — expected, see Fonts above.
- `tokens: 2 missing` — below the converter's threshold, non-blocking. If this
  number jumps back to ~16 and names `--admin-*`, the theme trim above was lost.

## Preview-authoring gotchas

- **`.shout` sets no colour of its own.** A heading on a bare
  `<div className="bg-ink">` renders black-on-black. Dark-surface cells must use
  the real `<Section tone="dark">` (which supplies `text-white`) or set a text
  colour explicitly. This bit the first SectionHead preview.
- **`.modal-overlay` and `.modal-close` are `position: fixed`.** Without a
  containing block they leave the card's flow, the preview root measures ~0px
  tall, and the screenshot catches only a sliver of backdrop. `Modal.tsx` wraps
  its cells in a `Stage` div carrying `transform: translateZ(0)` and an explicit
  height, which makes `fixed` resolve against the wrapper. Any future overlay
  preview needs the same treatment. `Modal` also has
  `cardMode: "single"` + `viewport` in config.
- **Pass `showLogo={false}` to `Modal`** in previews: the overlay wordmark loads
  `/brand/ace-battle-poland.svg` from the host app.
- Modal sub-parts (`ModalHead`/`Body`/`Foot`) get their type and padding from the
  surrounding `.modal` panel, so their previews wrap cells in a `.modal` div
  rather than rendering bare.
- **A white panel on the white preview page looks like broken CSS.** `.modal` is
  `#fff` and so is the page, so a bare `.modal` cell renders as floating text
  with no card edge — indistinguishable from "the class never applied". Put the
  panel on a `bg-bg-2` backdrop stage with a `minHeight` (all three modal
  sub-part previews and `Modal.tsx`'s `Stage` do this). Applies to any future
  white-surface component.
- **Icons need their size pinned and a text label in the cell.** The six SVGs in
  `icons.tsx` carry only a `viewBox` — no width/height, no CSS floor — so
  unconstrained they stretch to fill the card, and having no text nodes is the
  other half of the `[RENDER_THIN]` signature. Every icon instance gets
  height/width utilities and every cell carries a caption.
- **`Cbx` and `PhoneField` are light-surface only.** Their CSS (`.cbx`,
  `.ff-input`, `.phone-field__*`) hardcodes `background: #fff` and the
  `--form-*` ink variables, so on `Section tone="dark"` or `"red"` they render as
  white boxes with no relationship to the band. Neither preview shows a
  dark-surface story, deliberately.
- **`PhoneField`'s `label` is only the number input's placeholder** — there is no
  floating label, so a *filled* PhoneField shows no label at all and reads as an
  incomplete row. Its preview puts a mono `Eyebrow` caption in a sibling above
  the field; do not nest that caption inside `PhoneField`, which is itself a
  `<label>`.
- Review sheets capture at a wide viewport and scale down (~0.63x), and cells are
  ordered **alphabetically by export name**, not source order. Grade on
  proportion rather than measured pixels, and do not tell a story across cells
  that depends on file order.
- Cards are a narrowish measure: `max-w-sm` suits stacked block buttons, but row
  compositions (label left, chips right) need `max-w-lg` or they wrap.
- Writing a Tailwind size pair as `h-*` + `/w-*` inside a `/* … */` block comment
  **closes the comment early** on the `*/`. Say "height/width utilities" instead.
- `Container` and `Section` do not currently need `cardMode: "column"` — the
  sheet already lays cells out one per row at full width. They are the first two
  that would need it if that ever changes.

## Host-served assets the design system cannot ship

`Loader` and `LoadingScreen` render `/loading.webp` and `/loading.gif` from the
site root, and `Modal`'s overlay logo renders `/brand/ace-battle-poland.svg`.
These are app-served files, absolute-pathed, and are **not** part of the
bundle — so the loader tile cannot paint in a preview or in a rendered design.

Their preview cards therefore show the component plus a caption naming the
dependency, so the card documents the limitation instead of looking broken.
Uploading the asset was considered and rejected: the paths are absolute, so in
the design environment `/loading.webp` resolves against that origin, not the
project's files.

## Design findings worth fixing in the app (not sync problems)

Surfaced while building previews; both are real component behaviour:

1. **`FloatField` renders `hint` with the error style.** `renderHint()` uses the
   same `.ff-error-msg` class for `error` and `hint`, so a neutral hint appears
   in red and reads as a validation failure.
2. **`SectionHead`'s title has no tone handling.** `tone="light"` lightens the
   eyebrow and the description but the `<h2 className="shout shout-md">`
   inherits its colour, so the component only works on a dark surface if an
   ancestor sets one. Every current caller happens to satisfy that via
   `Section tone="dark"`.
3. **`Chip` is missing `whitespace-nowrap`.** `chipStyles` fixes the pill at
   `h-7` but lets the label wrap, so a two-word chip in a narrow flex row breaks
   to two lines and overflows its own pill. `docs/Chip.md` originally claimed
   chips "do not wrap" — the doc has been corrected to match reality, but the
   base class is what should actually gain `whitespace-nowrap`.

## Re-sync risks — what can silently go stale

- **A `src/components/ui` primitive adopting a next-intl namespace other than
  `common`** renders as an empty card, because `preview-context.tsx` exports only
  `common`. Same silent-failure shape as the `PhoneField` break above, and the
  same fix. Watch for it whenever a primitive gains `useTranslations`.
- **`PhoneField`'s `variant="light" | "dark"` is in the shipped `.d.ts` but has
  no styling in the bundle.** Those rules live in `src/app/series-flows.css`
  under `.ace-landing .phone-field--*`, and that stylesheet is not shipped (it is
  per-flow page CSS, the category `conventions.md` tells the design agent not to
  imitate). So the prop is a **silent no-op** for the design agent — it sets a
  class nothing styles. Left as-is deliberately on 2026-09-10, consistent with
  the scope decision to exclude page-bespoke CSS; the alternatives are to ship
  `series-flows.css` (+58 KB of one flow's CSS) or to drop `variant` from the
  contract via `cfg.dtsPropsFor.PhoneField`. **Unresolved — the user's call.**
- **`fonts.css` vs `layout.tsx`** — the highest-value drift to watch. A font
  change in the app does not propagate here, and the failure is silent (fallback
  faces, no error).
- **`.design-sync/pkg/index.ts` is a hand-maintained barrel.** A new component
  added to `src/components/ui/` will NOT appear in the design system until it is
  added there. Nothing fails loudly; the component is simply absent.
  **This has already happened once:** `hash-link.tsx` landed in commit `31df0dc`
  between syncs and was invisible to the 2026-09-10 run until the barrel was
  diffed against `ls src/components/ui/`. **Do that diff every re-sync** — it is
  the only thing that catches it. `HashLink` was then *deliberately* excluded
  (`componentSrcMap.HashLink = null`): it imports `Link`/`usePathname` from
  `@/i18n/navigation`, so like `LanguageSwitcher` it cannot render in a design.
  A future primitive that reads next-intl navigation belongs in the same bucket.
  `.design-sync/pkg/tsconfig.dts.json` pins `rootDir: "../.."`, and
  `build.mjs` hard-fails if tsc stops emitting the barrel declaration where it
  expects it — so a layout change there is caught, unlike a missing export.
- **`dtsPropsFor` for `Button`, `LinkButton` and `FloatField` is hand-written.**
  The converter filters inherited `@types/react` props (`[DTS_STYLE_SYSTEM]`),
  which would otherwise drop genuinely essential API — `href` on LinkButton,
  `value`/`onChange`/`placeholder` on FloatField, `disabled`/`type` on Button.
  These bodies do not track the source: if those components' props change, the
  contract the design agent sees will be wrong until the config is updated.
- **`ds-classlist.txt` is generated from a hand-curated set of families** in
  `css/build-css.mjs`. If the app adopts a Tailwind family that list does not
  cover, designs using it will render unstyled. The token colour list there also
  mirrors `tailwind.config.ts` by hand.
- **Only `src/components/ui` is in scope.** `landing/`, `marketing/` and
  `features/` are intentionally excluded; do not treat their absence as a bug.
- The two `url()` references in `landing.css` (`/landing/atmosphere.png`,
  `/landing/icons/calendar.svg`) are host-served too, same class of issue as the
  loader assets.

## Environment

- Playwright + chromium for the render check are installed inside `.ds-sync/`
  (not in the app's dependencies). A fresh clone needs that again — `.ds-sync/`
  is gitignored.
  **Match the playwright version to the chromium build already cached** rather
  than installing the latest and downloading ~200 MB: `ls ~/.cache/ms-playwright/`
  gives `chromium_headless_shell-<build>`, and the release pinning that build is
  the one to install. On 2026-09-10 the cache held builds 1148 and 1223, and
  `playwright@1.60.0` pins 1223 — so `npm i playwright@1.60.0` needed no browser
  download at all. A mismatch fails with
  `browserType.launch: Executable doesn't exist`. Verify a candidate by reading
  `node_modules/playwright-core/browsers.json` as a *file* (its exports map
  blocks `require()`), or
  `raw.githubusercontent.com/microsoft/playwright/v<X.Y.Z>/packages/playwright-core/browsers.json`
  for versions not yet installed. Rough calibration: 1.54→1181, 1.55→1187,
  1.56→1194, 1.59→1217, 1.60→1223, 1.61→1228, 1.62→1234.
- Windows: this checkout is shared by several concurrent sessions. Check file
  mtimes before committing and never `git add -A`.
