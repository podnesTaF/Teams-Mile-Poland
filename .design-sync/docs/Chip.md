---
category: Data display
---

# Chip

Small pill label for status and metadata — a category, a state, a count.
Not interactive; use [Button](Button.md) for anything clickable.

## Props

- `intent` — `default` (grey fill), `outline` (hairline only),
  `red` (accent, for urgency), `dark` (ink), `amber` (warning),
  `green` (success).
- `mono` — switch to JetBrains Mono. Use it for numbers, codes and
  times so they align down a column.

## Use

```tsx
<Chip intent="red">3 slots left</Chip>
<Chip intent="green">Confirmed</Chip>
<Chip mono>04:12.8</Chip>
```

Keep the text to a word or two. The pill is a fixed 28px tall but the label is
**not** `nowrap`, so a longer label in a narrow column wraps and overflows the
pill. In a tight row, give the chip's container room (`max-w-lg` rather than
`max-w-sm`) or add `whitespace-nowrap` yourself.
