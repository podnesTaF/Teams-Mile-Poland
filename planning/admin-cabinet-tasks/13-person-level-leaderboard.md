# Task 13 — Person-level leaderboard (персональные рейтинги)

Size: M. Dependencies: task 11 preferred. ⚠️ Product default: best-time ranking v1; a points-per-race season system is a client decision — don't build it unprompted.

## Background
The landing results section (`src/components/landing/results.tsx:29-57`) has an "All" tab that flat-maps every completed event's entries sorted by time — it ranks **result rows**, not people: a runner who ran two races appears twice; no dedupe, no aggregation. Identity building blocks: `event_results.registration_id` (nullable, `src/db/schema/event-results.ts`), `nameKey()` (`src/lib/events/name-key.ts:14`) as the fallback key — exactly how `findUserResults` matches (`src/lib/events/user-results.ts:55-81`). Levels from `computeLevel(timeCs, gender)` (`src/lib/events/levels.ts:44`). Results readers: `getPublicResults` / `getMergedResults` in `src/lib/events/results-data.ts` (DB-first, config-sheet fallback).

## Steps
1. Aggregation helper (e.g. `src/lib/events/leaderboard.ts`): fold all completed events' finisher rows into one entry per person — key by `registration_id → user` when present, else `nameKey(name)`+gender; keep best (lowest) `timeCs`, its event/date, level, and a races-run count. Pure function over the existing readers, mirroring `user-results.ts` conventions.
2. Rework the landing "All" tab to rank these person entries (best time ascending), showing name, best time, level, races count, and the event of the best time. Per-event tabs unchanged.
3. Gender split: the per-event tables already carry gender — decide with the existing UI: if the current "All" tab mixes genders, keep one list but show level (which is gender-aware); if it splits, split the person board the same way. Follow whatever `results.tsx` does today.
4. i18n: any new labels go into the existing results/landing namespace in pl/en/ua with key parity.
5. Leave the door open for admin/profile reuse (task 12 and a possible future season-points system) — keep the helper UI-free.

## Acceptance
- A runner with results in two events appears exactly once in the "All" tab, with their best time and correct races count.
- Rows without any identity match still appear (name-key grouping), never dropped.
- Per-event results tables byte-identical to before.
- typecheck/lint/build pass; landing stays statically prerenderable in all three locales (results readers are already build-safe — verify no dynamic API sneaks in).
