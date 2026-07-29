# CONTEXT.md Format

Lives at the repo root: `teams-mile-warshaw/CONTEXT.md`. One glossary for the event-site domain.

## Structure

```md
# Teams Mile

{One or two sentence description of what the product is.}

## Language

**Event**:
A single mile race in the series. Config-only — defined in the registry, never a DB row.
_Avoid_: race (ambiguous), meet

**Registration**:
A user's confirmed entry into one event — the `event_registrations` row.
_Avoid_: entry, signup (the act), booking

**Bib**:
The number assigned to a registration at check-in, unique within an event.
_Avoid_: number, tag
```

## Rules

- **Be opinionated.** When multiple words exist for the same concept, pick the best one and list the others under `_Avoid_`.
- **Keep definitions tight.** One or two sentences max. Define what it IS, not what it does.
- **Only include terms specific to this domain.** General programming concepts (server actions, migrations, SSG) don't belong even if the project uses them extensively. Before adding a term ask: is this a concept unique to the mile-events domain, or a general programming concept? Only the former belongs.
- **Flag legacy vs current.** Team/runner/captain/slot are legacy (frozen warsaw-2026). If listed at all, mark them clearly as legacy so no one revives them for the individual series.
- **Group terms under subheadings** when natural clusters emerge (e.g. Events, Registration, Check-in). A flat list is fine when small.
