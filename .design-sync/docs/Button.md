---
category: Actions
---

# Button

The primary action control. Renders a real `<button>`, so the native
button props (`disabled`, `type`, `onClick`, ...) pass straight through.

Type is always uppercase Manrope with wide tracking. Do not override the
font or letter-spacing — that cadence is the brand.

## Props

- `intent` — `primary` (accent red, the default), `dark` (ink),
  `ghost` (ink outline, for light surfaces), `ghostLight` (white
  outline, for ink and red surfaces), `link` (underlined inline action).
- `size` — `sm` (36px), `md` (48px, default), `lg` (56px).
  Ignored by `intent="link"`, which is always inline.
- `block` — full width.

## Use

```tsx
<Button intent="primary" size="lg">Register a team</Button>
<Button intent="ghost">See the rules</Button>
<Button intent="primary" block disabled>Sold out</Button>
```

Use `ghostLight` whenever the surrounding surface is
`Section tone="dark"` or `tone="red"` — `ghost` renders
ink-on-ink there and disappears.
