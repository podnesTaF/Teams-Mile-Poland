---
category: Layout
---

# Section

A full-bleed page band: sets the surface colour and the vertical rhythm,
and wraps its children in a [Container](Container.md). Pages are built by
stacking these.

## Props

- `tone` — `default` (white), `muted` (warm grey, for
  alternating bands), `dark` (ink), `red` (accent).
- `size` — `default` (96px padding) or `sm` (56px).

## Use

```tsx
<Section tone="muted">
  <SectionHead eyebrow="Format" title="How the race works" />
  <div className="grid gap-6 md:grid-cols-3">{cards}</div>
</Section>
```

Alternate `default` and `muted` down a page to separate bands
without drawing rules. On `dark` and `red`, switch nested
components to their light variants (`Button intent="ghostLight"`,
`Eyebrow tone="light"`).
