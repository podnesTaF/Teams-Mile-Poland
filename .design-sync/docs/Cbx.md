---
category: Forms
---

# Cbx

Checkbox row — an accent-red filled square with a label beside it. Used for
the consent and opt-in rows in the registration and contact modals.

Controlled, and `id` is required because the label binds to the input
with `htmlFor`.

## Props

- `id`, `checked`, `onChange` — all required.
- `children` — the label content. Links inside it are fine.
- `inline` — tighter variant for a single short line.

## Use

```tsx
<Cbx id="terms" checked={agreed} onChange={(e) => setAgreed(e.target.checked)}>
  I accept the <a href="/terms" className="underline">terms</a>
</Cbx>
```

Links in the label need no classes — `.cbx-text a` already inherits the colour
and underlines.

**Light surfaces only.** The `.cbx` rules hardcode a white box and the `--form-*`
inks, so on `Section tone="dark"` or `tone="red"` it renders as a white square
with no relationship to the band. Keep consent rows on white or `bg-bg-2`.
