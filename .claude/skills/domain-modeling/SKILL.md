---
name: domain-modeling
description: Build and sharpen the Teams Mile domain model. Use when the user wants to pin down domain terminology or a ubiquitous language, record an architectural decision, or when another skill needs to maintain the domain model.
---

# Domain Modeling

Actively build and sharpen the project's domain model as you design. This is the *active* discipline — challenging terms, inventing edge-case scenarios, and writing the glossary and decisions down the moment they crystallise. (Merely *reading* `CONTEXT.md` for vocabulary is not this skill — that's a one-line habit any skill can do. This skill is for when you're changing the model, not just consuming it.)

## File structure

This is a **single Next.js app**, so the glossary and ADRs live at the **repo root**:

```
teams-mile-warshaw/
├── CONTEXT.md            ← the glossary
├── docs/
│   ├── adr/              ← decisions, numbered 0001-slug.md
│   └── agents/           ← pipeline config (issue-tracker, cross-cutting-checklist)
├── src/
│   ├── lib/events/       ← the event config registry (registry.ts, types.ts) — source of truth for events
│   ├── db/schema/        ← Drizzle tables — source of truth for persisted data
│   └── features/         ← auth, event-registration, event-mailings, admin, profile
└── planning/             ← approved plans (mile-series-plan.md, …)
```

Create files lazily — only when you have something to write. If no `CONTEXT.md` exists, create one when the first term is resolved. If no `docs/adr/` exists, create it when the first ADR is needed.

## The domain

Individual mile running events (Aug 2026 series, one stadium). Core concepts to keep sharp: **event** (config-only, in the registry), **event series**, **registration**, **bib**, **check-in** / **no-show**, **club** (free-text team), **heat**, **event lifecycle status** (upcoming / registration_open / registration_closed / completed). Legacy team concepts (**team**, **runner**, **captain**, **slot**) belong to the frozen warsaw-2026 event — call it out when someone conflates legacy team language with the new individual-event language.

## During the session

### Challenge against the glossary

When the user uses a term that conflicts with the existing language in `CONTEXT.md`, call it out immediately. "Your glossary defines 'registration' as X, but you seem to mean Y — which is it?"

### Sharpen fuzzy language

When the user uses vague or overloaded terms, propose a precise canonical term. "You're saying 'entry' — do you mean the `event_registrations` row, or the act of registering? Those are different things." Watch especially for team-vs-individual drift.

### Discuss concrete scenarios

When domain relationships are being discussed, stress-test them with specific scenarios (a user registering for two events in the series; a bib collision at check-in; a no-show being reverted). Force the user to be precise about the boundaries between concepts.

### Cross-reference with code

When the user states how something works, check whether the code agrees. The **ground truth** is `src/lib/events/registry.ts` + `src/lib/events/types.ts` for events, and `src/db/schema/*` for persisted data. If you find a contradiction, surface it.

### Update CONTEXT.md inline

When a term is resolved, update `CONTEXT.md` right there. Don't batch these up. Use the format in [CONTEXT-FORMAT.md](./CONTEXT-FORMAT.md).

`CONTEXT.md` should be totally devoid of implementation details. It is a glossary and nothing else — not a spec, not a scratch pad.

### Offer ADRs sparingly

Only offer to create an ADR when all three are true:

1. **Hard to reverse** — the cost of changing your mind later is meaningful
2. **Surprising without context** — a future reader will wonder "why did they do it this way?"
3. **The result of a real trade-off** — there were genuine alternatives and you picked one for specific reasons

If any of the three is missing, skip the ADR. Use the format in [ADR-FORMAT.md](./ADR-FORMAT.md). (This project already has ADR-worthy decisions worth backfilling if asked: events-as-config-not-DB, `event_slug` text keys with no FK, freezing legacy team tables, Better Auth over the custom build.)
