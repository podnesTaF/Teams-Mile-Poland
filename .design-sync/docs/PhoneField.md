---
category: Forms
---

# PhoneField

Phone entry with a country dial-code picker beside the number. Keeps the
same height and border treatment as [FloatField](FloatField.md) so it lines
up in a form.

Controlled, and unusually `onChange` receives the combined string
rather than an event.

## Props

- `value` (required) — the full international number, e.g. `"+48512345678"`.
- `onChange` (required) — `(value: string) => void`.
- `label` — label for the number input.
- `error` — error string; switches to error styling.

## Use

```tsx
const [phone, setPhone] = useState("+48");

<PhoneField label="Phone" value={phone} onChange={setPhone} />
```

Two things to know. `label` is only the number input's **placeholder** — there is
no floating label, so once the field has a value no label is visible; add your
own caption above it (an `Eyebrow` works well) when the form needs a persistent
one. And like [Cbx](Cbx.md) it is **light-surface only**: the
`.phone-field__*` rules hardcode a white field and the `--form-*` inks, so it
does not belong on a dark or red band.
