---
category: Overlay
---

# ModalFoot

The action slot at the bottom of a [Modal](Modal.md), with a wider 24px gap
than the body. Put the primary action first; full-width
(`block`) buttons are the norm at the narrow sizes.

## Use

```tsx
<ModalFoot>
  <Button intent="primary" block>Confirm entry</Button>
  <Cbx id="news" checked={opt} onChange={onOpt}>Send me race updates</Cbx>
</ModalFoot>
```
