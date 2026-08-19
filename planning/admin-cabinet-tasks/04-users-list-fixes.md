# Task 04 — Admin users list: sort bug, pagination, phone, profile-complete stat

Size: M. Dependencies: none.

## Background
`/admin/users` (page `src/app/[locale]/admin/users/page.tsx`, data `src/features/admin/users-data.ts`) already has: Signed up (createdAt), Verified pill, First event badge, Aug regs, Races run columns; totals line "N people in the system · M verified · K matching" from `getUserStats()` (`users-data.ts:152-160`). Known issues:
1. **Sort bug**: `listUsers` docblock says "Newest accounts first" (`users-data.ts:55`) but the query orders `asc(users.name)` (`users-data.ts:141`).
2. **No pagination**: `listUsers` returns every row. A pagination idiom already exists on the roster (`src/features/admin/roster-query.ts` / roster pages, built in issue #40) — reuse it.
3. Search `q` covers name+email only (`users-data.ts`), phone is neither searchable nor shown as a column (users table has `phone`, `src/db/schema/auth.ts`).
4. "Confirmed profiles": admin currently surfaces only `emailVerified`. `isProfileComplete(user)` (`src/lib/auth/user-session.ts:75-91`: firstName+lastName+DOB+sex+phone) is not surfaced anywhere in admin. The client's "подтвержденные профили" likely means this — add it without waiting for their answer, alongside the existing verified count.

## Steps
1. Fix ordering to `desc(users.createdAt)`; add simple sort controls (at least Signed up ↑↓ / Name) following the roster's sort-param pattern.
2. Add pagination (page size ~50) preserving all existing filters in links.
3. Add phone to the `q` search (ILIKE on the stored value is fine for now — E.164 normalization is task 08) and a Phone column.
4. Extend `getUserStats()` with `profileComplete` count (SQL `count(*) filter (where …)` mirroring the `isProfileComplete` fields being non-null) and show it in the totals line; optionally a `complete` filter next to the existing verified filter.
5. Admin UI is English-only — no i18n keys needed.

## Acceptance
- Default order is newest accounts first; docblock and behavior agree.
- List paginates; filters + search + sort survive page navigation.
- Searching a phone fragment finds the user; Phone column renders.
- Totals line shows total / verified / profile-complete.
- typecheck, lint, build pass; filter partitions still sum correctly against a dev DB.
