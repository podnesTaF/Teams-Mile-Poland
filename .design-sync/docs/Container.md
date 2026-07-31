---
category: Layout
---

# Container

Centres content in the 1280px measure with the standard 24px gutter. Every
full-width band should put its content in one so the page edges line up.

## Props

- `as` — the element to render (`"div"` by default). Use
  `as="header"`, `as="footer"`, `as="main"` for landmarks.

## Use

```tsx
<Container as="header" className="flex items-center justify-between py-4">
  <Wordmark />
  <Button intent="ghost" size="sm">Sign in</Button>
</Container>
```

[Section](Section.md) already wraps its children in a Container — do not
nest a second one inside it.
