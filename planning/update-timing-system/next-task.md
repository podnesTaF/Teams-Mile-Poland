# Task: slice 2 — the mid-event loop from the timing diagrams

## Where this comes from

The flow diagram in this folder (`WhatsApp Image 2026-08-10 at 10.16.58.jpeg`,
analyzed in `comment.md`) has one box the platform still cannot honour:
**"Import results for qualifications races"** — results flow back from
RaceResult *during* the event, not just after it, and two things depend on
them mid-event:

1. finals heats are built from qualification times;
2. participants "check results of the events" while the event is running.

Slice 1 (already implemented, see `plan.md` status note) built the transport:
`event_results` table, admin upload with preview/commit, replace-per-heat
idempotent imports, DB-first public readers. It deliberately stopped short of
the two mid-event consumers above. Build them now.

## Part A — seed finals from qualification results

The heat builder (`src/features/admin/components/heat-builder.tsx`,
`src/features/admin/heat-actions.ts` / `heats-data.ts`) can already create and
edit heats. Add the bridge from imported results:

- On the Heats tab, when `event_results` holds rows for this event's finished
  heats, offer "Seed final from results": pick a target heat, pick how many
  qualifiers (e.g. top N across imported heats by `time_cs`), and assign those
  runners to the target heat — only rows with a `registration_id` link can be
  seeded (unlinked rows have nobody to assign; surface them as a warning, never
  guess).
- Respect existing rules: capacity capped at the bib pool (ADR 0003), heat
  publish/notify flow unchanged (`publishHeatsAndNotify` handles the delta
  emails — re-publish after seeding is the existing, already-idempotent path).
- Data source helper belongs in `src/features/admin/results-import/data.ts`
  (e.g. `topQualifiers(eventSlug, opts)`), reading `event_results` joined to
  registrations.

## Part B — public results that update during the event

Participants must be able to see results between qual and final. Today results
render only on the landing leaderboard (static, revalidated on import commit)
— fine for after the event, wrong shape for during it.

- Add a public per-event results page, e.g. `/[locale]/events/[slug]/results`,
  next to the existing start-list page (`events/[slug]/heats`). **Do not copy
  the start-list caching model** — that page is static-until-revalidated
  because bibs never render there (PRD #26); a results page changes on every
  import. Make it dynamic (or short-revalidate) and render from
  `getMergedResults` (`src/lib/events/results-data.ts`), grouped per heat with
  places and times, i18n'd in all three locales like the start-list page.
- Decide DNF/DNS/DSQ display here: the table stores them; the public model so
  far shows finishers only. Showing "DNF" per heat is honest mid-event —
  extend the public projection deliberately (new type, not a hack on
  `ResultEntry`) or explicitly punt with a comment.
- Link the page from the event detail page and/or start list once the event
  has imported results; the import commit action
  (`src/features/admin/results-actions.ts`) must revalidate it.

## Prerequisite chore (do first, it is small)

Slice 1 is **uncommitted** in the shared working tree. Before touching
anything: check `git status`/mtimes, stage slice-1 files explicitly (list in
git status; never `git add -A`), run the static gate (tsc, lint on touched
files, build), commit. Then commit slice 2 separately.

## Constraints (project memory — real, not boilerplate)

- Live DB, no Neon branch: any fixture rows you create, delete scoped to
  created ids / your own high heat numbers (95+). `scripts/verify-results-import.ts`
  shows the pattern and must still pass 20/20 when you're done.
- Verify scripts must not send mail; seeding heats does not mail anyone until
  the admin presses publish — keep that separation.
- HTTP checks need content markers, not status codes (streaming hides
  redirects). Admin UI is English-only; public pages are pl/en/ua.
- `(heat, bib)` is the result identity — never key anything on bib alone.
- Read `node_modules/next/dist/docs/` before writing Next.js code (repo rule:
  this Next version differs from training data).

## Done when

- An admin can: import qual results → seed a finals heat from top times →
  re-publish; verified over HTTP with fixtures, cleaned up after.
- The public results page renders imported results in all three locales and
  updates after an import commit; gated with content markers.
- A verify script covers `topQualifiers` + the seeding action round-trip.
- Both commits landed with the static gate green.

## Out of scope

- my.raceresult.com live polling (slice 3) — manual upload stays the transport.
- The diagram's payment lane — organizer decision, not code.
- LED board / hardware diagram — offline concern.
