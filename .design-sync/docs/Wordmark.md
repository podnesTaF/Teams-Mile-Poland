---
category: Brand
---

# Wordmark

The TEAMS | MILE lockup — heavy italic Alumni Sans with the skewed accent
bar between the two words. Pure text and CSS, so it stays crisp at any size
and needs no image asset.

## Props

- `size` — font size in px (default 20). The bar scales with it.
- `light` — white text, for ink and red surfaces.

## Use

```tsx
<Wordmark size={28} />
<Wordmark size={20} light />
```

Do not rebuild the lockup by hand or add space around the bar — the skew
and the spacing are part of the mark.
