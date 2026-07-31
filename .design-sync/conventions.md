# Building with the Ace Battle Run design system

A team-mile race brand: hard edges (2px radius everywhere), heavy italic
display type, monospace metadata, and one signature red on black and white.

## Setup

No provider or theme wrapper. Import a component and render it — components
are styled by `styles.css`, which is already loaded.

## Two styling systems, and which to use

**1. Token utilities — the default.** Tailwind utilities bound to the brand
tokens. They work anywhere, on any surface, and are what you should reach for.

| Family | Use these exact names |
|---|---|
| Surfaces | `bg-bg` (white) · `bg-bg-2` (warm grey) · `bg-bg-3` · `bg-ink` (near-black) · `bg-accent` (signature red) · `bg-accent-hot` |
| Text | `text-ink` · `text-ink-2` · `text-muted` · `text-muted-2` · `text-accent` · `text-white` · `text-success` · `text-warning` |
| Borders | `border-line` (hairline) · `border-line-2` · `border-ink` · `border-accent` |
| Type faces | `font-display` (Alumni Sans, heavy italic) · `font-display-alt` (Manrope, UI + buttons) · `font-sans` (Inter, body) · `font-mono` (JetBrains Mono, metadata) |
| Radius | `rounded-sm` / `rounded-md` / `rounded-lg` are **all 2px** by design. `rounded-pill` and `rounded-none` are the only real alternatives. Never round more than 2px. |
| Measure | `max-w-container` (1280px) · `max-w-prose` (65ch) |
| Misc | `text-eyebrow` (11px/0.14em) · `ease-snappy` · `animate-pulse-slow` · `shadow-sm`/`shadow`/`shadow-lg` |

Standard Tailwind layout, spacing and sizing utilities are all available with
`sm:` `md:` `lg:` `xl:` and `hover:` `focus:` `disabled:` `group-hover:`
variants. **Arbitrary values are not** — the stylesheet is pre-compiled, so
`w-[137px]` or `bg-[#ff0000]` resolve to nothing. Use the scale, or inline
`style` for a genuine one-off.

**2. Semantic classes from the stylesheet.** Use these instead of rebuilding
their look out of utilities:

- Display headings: `shout` + one of `shout-xl` / `shout-lg` / `shout-md` /
  `shout-sm`. `shout` sets the face, weight and uppercase transform but **not a
  colour** — it inherits, so on a dark surface an ancestor must set `text-white`.
- `eyebrow` — the mono uppercase kicker (`eyebrow-ink`, `eyebrow-red` recolour it).
- Dialogs: `modal` panel, `modal-md` / `modal-lg`, `modal-soft`, `modal-head`,
  `modal-title`, `modal-body`, `modal-foot`.
- Fields: `ff` wrapper, `ff-input` / `ff-select` / `ff-textarea`, `ff-err`,
  `ff-error-msg`. Prefer the `FloatField` component over these directly.
- `cbx` / `cbx-text` for checkbox rows — or just use `Cbx`.

## The `.ace-landing` scope — read this before using it

`landing.css` carries the marketing design language, and **every one of its
selectors is scoped to a `.ace-landing` root**. Outside that root none of it
applies; inside it, `.ace-landing` itself sets a dark background and white
text, so it is effectively a dark theme root, not a neutral wrapper.

Only wrap a screen in it when you want the dark marketing look:

```tsx
<div className="ace-landing">
  <section className="section">
    <h2 className="head t-sec">Four runners. One mile.</h2>
    <a className="btn btn-red" href="/register">Register a team</a>
  </section>
</div>
```

Available inside that scope: `head` with `t-hero` / `t-sec` / `t-40` / `t-32` /
`t-24` / `t-20` / `t-cta`; `btn` with `btn-red` / `btn-white` / `btn-stroke` /
`btn-sm` / `btn-block`; `section`, `sect-glow`, `cards3`, `stat`, `stats`.

**Do not imitate the per-page prefixes** you will find in `landing.css` —
`iv-*`, `ev-*`, `pstd-*`, `tk-*`, `aba-*`, `rp-*`, `news-*`, `gallery-*` and
friends. Each is one screen's bespoke, one-off CSS; they are the legacy this
design system exists to replace. Build new screens from the components and the
token utilities instead.

## Forms are light-surface only

`FloatField`, `PhoneField` and `Cbx` hardcode a white field and the `--form-*`
inks, so they have no dark variant. Keep forms on `bg-bg` or `bg-bg-2`; putting
one inside `Section tone="dark"` or `tone="red"` gives white boxes floating on
the band. `PhoneField`'s `label` is only a placeholder, so a filled field shows
no label — add your own caption above it when one is needed.

## Two components need host-served files

`Loader` and `LoadingScreen` render `/loading.webp` and `/loading.gif`, and
`Modal`'s overlay wordmark renders `/brand/ace-battle-poland.svg`. Those are
absolute paths served by the app, not shipped here, so they will not paint.
Pass `showLogo={false}` to `Modal`, and prefer a text or skeleton wait state
over `Loader`.

## Where the truth lives

- `_ds/<folder>/styles.css` and the `_ds_bundle.css` it imports — every class
  and token above, authoritative. Read it before inventing a style.
- `components/<group>/<Name>/<Name>.prompt.md` — per-component usage and props.
- `components/<group>/<Name>/<Name>.d.ts` — the exact prop contract.

## An idiomatic screen

```tsx
<Section tone="muted">
  <SectionHead
    eyebrow="Warsaw · August 2026"
    title="Four runners. One mile. One clock."
    description="Teams of four race the mile together; the finish is the last runner across."
  />
  <div className="grid gap-6 md:grid-cols-3">
    {heats.map((h) => (
      <article key={h.id} className="border border-line bg-bg p-6">
        <Eyebrow>{h.time}</Eyebrow>
        <h3 className="mt-2 font-display-alt text-xl font-bold">{h.name}</h3>
        <div className="mt-4 flex items-center gap-3">
          <Rank rank={h.place} intent="red" />
          <Chip mono>{h.result}</Chip>
        </div>
      </article>
    ))}
  </div>
  <LinkButton href="/heats" intent="primary" size="lg" className="mt-10">
    Full start list
  </LinkButton>
</Section>
```

Components carry the design; utilities and the token scale carry your layout
glue between them.
