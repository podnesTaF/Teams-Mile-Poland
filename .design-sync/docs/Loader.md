---
category: Feedback
---

# Loader

The brand loading animation — a triangle-mosaic tile, served as an animated
WebP with a GIF fallback.

**Host assets required.** It renders `/loading.webp` and
`/loading.gif` from the site root. Those files are served by the app
and are not shipped in this design system, so the tile shows as a broken
image anywhere they are absent. Prefer a text or skeleton state if you
cannot serve them.

## Props

- `size` — rendered square size in px (default 120).
- `label` — accessible label, also the image `alt`
  (default `"Loading..."`).

## Use

```tsx
<Loader size={64} label="Loading results..." />
```

For a whole-page wait use [LoadingScreen](LoadingScreen.md).
