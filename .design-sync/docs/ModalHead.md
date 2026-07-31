---
category: Overlay
---

# ModalHead

Title block for a [Modal](Modal.md): the heading, an optional tag line above
it, and an optional subtitle below.

## Props

- `title` (required) — heading content.
- `sub` — subtitle paragraph.
- `subTag` — small line above the title, for step or context labels.
- `titleSize` — `"sm"` for a 24px title in tighter dialogs.
- `id` — pair it with the Modal's `labelledBy` for accessible naming.

## Use

```tsx
<ModalHead
  id="reg-title"
  subTag="Step 2 of 3"
  title="Who is running?"
  sub="Add all four runners; you can edit them later."
/>
```
