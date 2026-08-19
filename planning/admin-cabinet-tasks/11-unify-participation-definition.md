# Task 11 — One definition of "races participated" everywhere

Size: M. Dependencies: none (do before tasks 12/13 so they build on the unified definition).

## Background
Three disagreeing definitions ship today:
1. Profile stat: non-cancelled registrations — `src/app/[locale]/profile/page.tsx:165,225`.
2. Admin users list `raceCount`: `checked_in` registrations + legacy attended — `src/features/admin/users-data.ts:56-142`.
3. Referral stats participation: `checked_in` only, legacy ignored — `src/features/referral/data.ts:101-118`; worse, the comment at `users-data.ts:41-45` claims it matches the referral definition, which is false.

Recommended canonical definition (confirm with owner if in doubt): **participated = `event_registrations.status = 'checked_in'` + legacy attended (`legacy_participations`)**; keep "registered" as a separate explicitly-named count where needed (profile may want both: "registrations" and "races run").

## Steps
1. Create one shared helper (e.g. `src/lib/events/participation.ts`) exposing the canonical count(s) per user id set — SQL building blocks reusable by `users-data.ts`, `referral/data.ts`, and the profile loader. Keep it a thin query helper, not an abstraction layer.
2. Migrate the three call sites to it. On the profile, decide the displayed stat: show "races run" (canonical) rather than registration count, or show both — match the existing stat-strip design (`profile/page.tsx:223-236`); update `profile.*` i18n keys in pl/en/ua if labels change (key parity across all three catalogs).
3. Referral stats: participations now include legacy attended for referred users (rare but consistent). Note: referral counts live in both the profile section and `/admin/referrals` (`src/features/admin/referrals-data.ts:22-45`) — both go through `getReferralStats`/`listReferrers`; align both.
4. Fix the false comment at `users-data.ts:41-45`.

## Acceptance
- All surfaces (profile stat, admin users list, admin referrals, profile referral section) report from the same definition; a spot-check user shows identical counts everywhere.
- i18n key parity holds across pl/en/ua if labels changed.
- typecheck/lint/build pass.
