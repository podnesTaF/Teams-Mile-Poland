---
category: Actions
---

# LinkButton

Button styling on a real `<a>`. Use it whenever the action navigates;
use [Button](Button.md) when it submits or mutates state.

Takes the same `intent` / `size` / `block` props as Button,
plus the native anchor props — in practice `href` is required.

## Use

```tsx
<LinkButton href="/events/warsaw-2026" intent="primary" size="lg">
  Event details
</LinkButton>
<LinkButton href="/rules" intent="link">Read the full rules</LinkButton>
```
