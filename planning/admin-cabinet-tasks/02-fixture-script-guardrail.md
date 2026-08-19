# Task 02 — Guardrail: fixture/verify scripts must refuse the live DB

Size: S. Dependencies: none (pairs with task 01, which cleans up the damage this prevents).

## Background
Several scripts insert directly into live tables, bypassing every action-layer guard (`createFreeRegistration` in `src/features/event-registration/data.ts:31-47` inserts unconditionally). This already caused real debris: 8 fake registrations + 9 draft heats on `mile-2026-08-29` from a fixture session (phase log line ~171). Offending scripts:
- `scripts/seed-heats-fixture.ts` (inserts users + registrations + heats on `mile-2026-08-29`)
- `scripts/verify-results-import.ts` (SLUG `mile-2026-08-29`, inserts users + registrations + heats)
- `scripts/verify-results-seeding.ts` (same slug)
- `scripts/verify-heat-publish.impl.ts` and `scripts/verify-race-morning.ts` (fixture ground on `mile-2026-08-22`)

## Steps
1. Add a small shared helper (e.g. `scripts/lib/guard.ts`): refuse to run unless `ALLOW_FIXTURES=1` is set, and print which DATABASE_URL host it is about to write to before proceeding. Keep it dependency-free.
2. Call it at the top of each script above, before any DB write.
3. Make sure `--teardown` modes are also gated (they delete data — same risk class).
4. Match existing script conventions in `scripts/` (arg parsing, logging style).

## Acceptance
- Running any of the five scripts without `ALLOW_FIXTURES=1` exits non-zero with a clear message and performs zero DB writes.
- With the env var set, behavior is unchanged.
- `npm run typecheck` and `npm run lint` pass.
