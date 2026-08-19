# Task 08 — Dedup keys: E.164 phone column + lower(email) safety index

Size: M. Dependencies: none. Blocks tasks 09 and 10.

## Background
Duplicate detection is entirely absent. Email is DB-unique (`users_email_unique`, `src/db/migrations/0005_odd_yellowjacket.sql:45`) but only case-normalized by convention — every client path lowercases (`sign-up-form.tsx:46`, `sign-in-form.tsx:40`, `event-registration/schemas.ts:15`, `admin-grant.ts:20`) yet nothing enforces it at DB level. Phone (`users.phone`, `src/db/schema/auth.ts`) has no index, no uniqueness, and is stored as a display string — `normalizePhone()` (`src/lib/phone.ts:186-190`) returns "+48 512 345 678", not a canonical key. `libphonenumber-js` is already a dependency (used in `src/lib/phone.ts`).

## Steps
1. Schema: add `users.phone_e164 text` + non-unique index (duplicates must remain representable so we can report them; do NOT make it unique). Additive drizzle migration via `npm run db:generate`; read the emitted SQL; legacy tables untouched.
2. Write path: wherever `phone` is written (profile form actions in `src/features/profile/`, guest registration `src/features/event-registration/actions.ts`, admin edits if any — grep for `phone` writers), also derive and store E.164 via `parsePhoneNumberFromString` (default country PL when no `+`), null when unparseable.
3. Backfill script `scripts/backfill-phone-e164.ts` for existing rows (gated per task 02's guardrail convention; idempotent; dry-run default, `--write` to apply — mirror `scripts/import-first-event.ts` conventions).
4. Email: first check for existing case-variant duplicates (`select lower(email), count(*) … group by 1 having count(*) > 1`); if clean, add a unique index on `lower(email)` in the same migration; if not clean, report and stop (resolution is manual).
5. Keep the display `phone` field as-is — E.164 is an additional key, not a replacement.

## Acceptance
- Migration applied to a Neon branch first; emitted SQL reviewed; existing rows backfilled (dry-run output shown before `--write`).
- New/updated profiles store both display and E.164 forms; unparseable input degrades to null E.164 without breaking the form.
- `lower(email)` unique index in place (or a documented blocker listing the conflicting rows).
- typecheck/lint/build pass.
