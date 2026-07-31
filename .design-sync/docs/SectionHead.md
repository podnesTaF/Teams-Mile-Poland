---
category: Layout
---

# SectionHead

The standard heading block for a [Section](Section.md): optional eyebrow,
the display heading, and an optional lead paragraph. Use it rather than
hand-rolling an `<h2>` so the type scale and spacing stay consistent.

## Props

- `title` (required) — the heading. Rendered as
  `<h2 class="shout shout-md">`.
- `eyebrow` — kicker text above the title.
- `description` — lead paragraph below, capped at a 60-character measure.
- `tone` — `default`, or `light` on dark and red surfaces.
- `align` — `start` (default) or `center`.

## Use

```tsx
<SectionHead
  eyebrow="Warsaw · August 2026"
  title="Four runners. One mile. One clock."
  description="Teams of four race the mile together, and the finish is the last runner across."
/>
```
