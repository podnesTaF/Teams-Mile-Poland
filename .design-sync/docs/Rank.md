---
category: Data display
---

# Rank

Fixed-width finishing-position badge in heavy italic Alumni Sans. Built for
results tables and standings, where equal width keeps the numbers in a
straight column.

## Props

- `rank` (required) — the string to show: `"1"`, `"12"`, `"DNF"`.
- `intent` — `ink` (default), `red` (podium), `outline`,
  `outlineLight` (on dark surfaces).
- `size` — `sm`, `md` (default), `lg`.

## Use

```tsx
<Rank rank="1" intent="red" size="lg" />
<Rank rank="2" />
<Rank rank="DNF" intent="outline" size="sm" />
```

Convention: red for the podium, ink for everyone else.
