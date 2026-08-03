---
category: Overlay
---

# Modal

The brand dialog. Renders nothing while `open` is false. Escape and an
overlay click both call `onClose`, and body scroll locks while it is
open.

Compose the inside from [ModalHead](ModalHead.md),
[ModalBody](ModalBody.md) and [ModalFoot](ModalFoot.md).

## Props

- `open` and `onClose` — both required.
- `onBack` — shows a back chevron, for multi-step flows.
- `size` — `sm`, `md` (480px), `lg` (1073px), or omit
  for the base width.
- `soft` — light grey panel instead of white.
- `icon` — node for the icon slot above the title.
- `showLogo` — overlay wordmark, **on by default**. It loads
  `/brand/ace-battle-poland.svg` from the host app, so pass
  `showLogo={false}` anywhere that file is not served.
- `bgImage`, `labelledBy`.

## Use

```tsx
<Modal open={open} onClose={close} size="md" showLogo={false}>
  <ModalHead title="Register your team" sub="Four runners, one entry." />
  <ModalBody>
    <FloatField label="Team name" />
  </ModalBody>
  <ModalFoot>
    <Button intent="primary" block>Continue</Button>
  </ModalFoot>
</Modal>
```
