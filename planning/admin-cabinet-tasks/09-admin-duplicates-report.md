# Task 09 — Admin duplicates report

Size: M. Dependencies: task 08 (E.164 column). Acceptance example: the "Marcin Hildebrand" case the client reported.

## Background
Admins have no way to see that one person holds two accounts. Grouping keys now available: `users.phone_e164` (task 08), `lower(email)` near-misses, and normalized name — `nameKey()` (`src/lib/events/name-key.ts:14`) already exists and is used for results↔profile matching (`src/lib/events/user-results.ts:55-81`); combine with `date_of_birth` to cut false positives.

## Conventions to follow
Admin feature idioms: data module in `src/features/admin/` (like `users-data.ts`), page under `src/app/[locale]/admin/`, `requireAdmin(locale, "view")` gate, `AdminShell` nav (`src/features/admin/components/shell/admin-nav.ts` — add the item capability-filtered per task 05), English-only admin UI, tables/pills matching existing components.

## Steps
1. `src/features/admin/duplicates-data.ts`: three group queries —
   - same `phone_e164` (non-null), >1 user;
   - same `nameKey(name)` + same `date_of_birth` (both non-null), >1 user;
   - (diagnostic, likely empty after task 08's index) same `lower(email)`.
   Each group: user id, name, email, phone, createdAt, races-run count (reuse the aggregate approach in `users-data.ts:56-142`).
2. Page `/admin/users/duplicates` (or a section on `/admin/users` — separate page preferred to keep the list light): grouped cards, each member linking to `/admin/users/[id]`, with the signal that matched (phone / name+DOB).
3. Link from `/admin/users` header ("Possible duplicates: N") when N > 0.
4. No merge tooling in this task — resolution is manual via the existing user detail (delete / admin-register). State that on the page.

## Acceptance
- Marcin Hildebrand's duplicate pair (if still present in prod data) appears grouped with the matching signal shown.
- No false-positive explosion: name-only matches without DOB are excluded.
- Page renders empty-state cleanly when there are no groups.
- typecheck/lint/build pass; queries verified against a dev/Neon-branch DB with seeded duplicates.
