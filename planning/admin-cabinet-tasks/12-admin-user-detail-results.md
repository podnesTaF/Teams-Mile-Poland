# Task 12 — Admin user detail: races / best time / results summary

Size: M. Dependencies: task 11 preferred (uses the canonical participation definition).

## Background
`/admin/users/[id]` (`src/app/[locale]/admin/users/[id]/page.tsx`, data `getUserDetail` at `src/features/admin/users-data.ts:183-229`) shows profile fields + a unioned legacy⋃series history (event, type, status, bib, registered-at) — but no race count, no times, no results, no level. The profile page already computes all of this for the runner themself: `findUserResults(fullName, participations, resultsBySlug, directRefs)` (`src/lib/events/user-results.ts:49` — pure function over `event_registrations` + `legacy_participations` + results readers in `src/lib/events/results-data.ts`), levels via `computeLevel` (`src/lib/events/levels.ts:44`). Reuse that stack — do not re-derive matching logic.

## Steps
1. In the user detail loader, mirror the profile page's results assembly (see `profile/page.tsx:118-135` for the exact call sequence) for the target user.
2. Render: a small stat row (races run — canonical definition from task 11, best time, current level) + a results table per event (place/total, heat, time, level) alongside the existing HistoryCard. Admin UI English-only; match existing admin card/table idioms.
3. Keep the page fast: results readers are DB-first with config fallback (`getPublicResults`) — load only events the user participated in, as the profile does.

## Acceptance
- A user with imported results (e.g. someone from mile-2026-08-01 or mile-2026-08-15) shows the same times/levels on `/admin/users/[id]` as on their own profile.
- A user with zero results renders the history exactly as before plus an empty-state stat row.
- typecheck/lint/build pass.
