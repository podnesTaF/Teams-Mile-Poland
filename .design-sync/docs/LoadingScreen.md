---
category: Feedback
---

# LoadingScreen

Full-viewport branded wait state — a centred [Loader](Loader.md) with
`role="status"`. This is the route-level loading fallback.

Takes no props, and inherits Loader's host-asset requirement: it needs
`/loading.webp` and `/loading.gif` served from the site root.

## Use

```tsx
export default function Loading() {
  return <LoadingScreen />;
}
```
