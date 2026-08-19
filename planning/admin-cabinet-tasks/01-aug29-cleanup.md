# Task 01 — Clean up mile-2026-08-29 fixture debris + participant list

Size: S. Dependencies: none. Touches live data — confirm with owner before deleting.

## Background
The client asked "who are the participants on Aug 29?". Answer: `mile-2026-08-29` is `registration_open` (`src/lib/events/registry.ts:76`), so real sign-ups exist, **but** the event also holds debris from a 2026-07-28 test session that never tore down (documented in `planning/mile-series-plan.md` phase log, line ~171): 8 registrations under `uifix-1..8@example.invalid` + 9 draft heats, inserted by `scripts/seed-heats-fixture.ts` (see its insert logic around lines 20–95; it has a `--teardown` mode).

## Steps
1. Inspect current state on the live DB: registrations for `mile-2026-08-29` (join `event_registrations` × `users`), and heats for that slug (`event_heats`). Count fixture vs real rows.
2. Run `scripts/seed-heats-fixture.ts --teardown` (or a targeted delete if teardown doesn't cover everything) to remove the `@example.invalid` users, their registrations, and the 9 draft heats. Verify nothing else references those user ids (referrals `referred_by` is `on delete set null` — fine).
3. Re-verify the admin roster page `/admin/events/mile-2026-08-29` shows only genuine registrations.
4. Produce a short report for the client: remaining genuine Aug-29 registrations — name, email, registration date, source if inferable (normal vs guest vs admin-registered). Deliver as a markdown table in the final message (do not commit personal data to the repo).

## Acceptance
- Zero `@example.invalid` users/registrations/heats remain for `mile-2026-08-29`.
- No genuine registration was deleted (row counts before/after reconcile).
- Client-ready participant list produced.
