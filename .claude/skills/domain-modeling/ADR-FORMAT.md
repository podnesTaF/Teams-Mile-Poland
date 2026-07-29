# ADR Format

ADRs live in `docs/adr/` at the repo root (`teams-mile-warshaw/docs/adr/`) and use
sequential numbering: `0001-slug.md`, `0002-slug.md`, etc.

Create the `docs/adr/` directory lazily — only when the first ADR is needed.

## Template

```md
# {Short title of the decision}

{1-3 sentences: what's the context, what did we decide, and why.}
```

That's it. An ADR can be a single paragraph. The value is in recording *that* a decision was made and *why* — not in filling out sections.

## Optional sections

Only include these when they add genuine value. Most ADRs won't need them.

- **Status** frontmatter (`proposed | accepted | deprecated | superseded by ADR-NNNN`) — useful when decisions are revisited
- **Considered Options** — only when the rejected alternatives are worth remembering
- **Consequences** — only when non-obvious downstream effects need to be called out

## Numbering

Scan `docs/adr/` for the highest existing number and increment by one.

## When to offer an ADR

All three of these must be true:

1. **Hard to reverse** — the cost of changing your mind later is meaningful
2. **Surprising without context** — a future reader will look at the code and wonder "why on earth did they do it this way?"
3. **The result of a real trade-off** — there were genuine alternatives and you picked one for specific reasons

If a decision is easy to reverse, skip it — you'll just reverse it. If it's not surprising, nobody will wonder why. If there was no real alternative, there's nothing to record beyond "we did the obvious thing."

### What qualifies

- **Architectural shape.** "Events are config in the registry, never DB rows; only registrations/check-in persist."
- **Data-model boundaries.** "Event tables are keyed by `event_slug` text with no FK to events, so the registry stays the single source of truth."
- **Technology choices that carry lock-in.** Database, auth provider, email provider, deployment target. Not every library — just the ones that would take a quarter to swap out (e.g. Better Auth over the custom build).
- **Boundary and scope decisions.** "Legacy team tables (teams/runners/slot_counter) are frozen and never migrated; individual-event features use event_* tables." The explicit no-s are as valuable as the yes-s.
- **Deliberate deviations from the obvious path.** Anything where a reasonable reader would assume the opposite (auth forms use plain useState, not react-hook-form). These stop the next engineer from "fixing" something that was deliberate.
- **Constraints not visible in the code.** SSG/static-export limits, trilingual-i18n requirements, cron/CRON_SECRET assumptions.
- **Rejected alternatives when the rejection is non-obvious.** The dropped 30-free/20-paid slot system and Stripe path were removed for "all free, unlimited" — record why so nobody re-adds a counter table in six months.
