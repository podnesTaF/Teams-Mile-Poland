---
category: Forms
---

# FloatField

The form field used across the registration and contact flows. One
component covers three controls through `as`, so a whole form keeps a
single 60px rhythm.

The label renders as the control's placeholder rather than a floating
label — deliberate, and explained in the component source.

## Props

- `as` — `"input"` (default), `"textarea"`, or `"select"`.
- `label` — the label/placeholder text.
- `error` — error string; also switches the field to error styling.
- `hint` — helper text, shown when there is no error.
- Native props for the chosen control pass through: `value`,
  `onChange`, `type`, `name`, `required`,
  `disabled`, `rows` for textarea, and `children` for
  select options.

## Use

```tsx
<FloatField label="Full name" name="name" required />
<FloatField label="Email" type="email" error="Enter a valid email" />
<FloatField as="select" label="Team size">
  <option value="4">4 runners</option>
</FloatField>
<FloatField as="textarea" label="Anything we should know?" rows={4} />
```

Stack fields in a [ModalBody](ModalBody.md) or a
`flex flex-col gap-3` wrapper.
