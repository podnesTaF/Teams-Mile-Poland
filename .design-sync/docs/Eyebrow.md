---
category: Typography
---

# Eyebrow

The small mono uppercase label above a heading — a section kicker, a field
group label, a metadata line. JetBrains Mono, 11px, 0.14em tracking.

## Props

- `tone` — `muted` (default), `ink`, `red`,
  `light` (on dark surfaces).

## Use

```tsx
<Eyebrow tone="red">Warsaw · 2026</Eyebrow>
<h2 className="shout shout-md">Race the mile as a team</h2>
```

It is an inline `<span>`, so add `className="block mb-4"` when it
should sit on its own line. [SectionHead](SectionHead.md) already does that.
