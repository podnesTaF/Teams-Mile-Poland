# Task 10 — Registration-time duplicate warning (phone)

Size: S. Dependencies: task 08 (E.164 column). ⚠️ Blocked on client answer: warn-and-allow vs hard-block a second account with the same phone. Default to **warn/flag, don't block** until they answer.

## Background
Today the same person can create a second account with a new email and the same phone, invisibly. After task 08, phone has a canonical `phone_e164` key to match on. Surfaces where a phone first enters the system:
- Guest event registration: `registerAsGuest` (`src/features/event-registration/actions.ts:117+`, schema `src/features/event-registration/schemas.ts:14`).
- Profile completion form: `src/features/profile/` actions (phone became mandatory for registration per ADR-0002 amendment; `isProfileComplete` at `src/lib/auth/user-session.ts:75-91`).
- Admin: `adminRegisterUserForEvent` (`src/features/admin/users-actions.ts:89`) doesn't take a phone, but the admin user detail is where a flag should show.

## Steps
1. Shared helper (e.g. in `src/features/profile/` or a small `src/lib/users/duplicates.ts`): `findUsersByPhoneE164(e164, excludeUserId)`.
2. Guest registration + profile save: after computing E.164, if another account holds it, per the default policy do NOT block — persist normally but surface a notice. For admin visibility, no schema change needed: the duplicates report (task 09) already catches it; optionally add a flash-style note in the admin user detail ("Phone shared with <other user>", linking there).
3. User-facing copy (only if the client later chooses to block): trilingual keys in the existing registration namespace; until then keep user-facing flow unchanged — the warning is admin-facing only. This avoids leaking "this phone exists" to strangers (enumeration risk — mirror the non-revealing approach used by `/unsubscribe`).
4. If the client answers "hard block": convert the guest/profile paths to reject with a translated error, keeping the admin override path (admin can still register the user manually).

## Acceptance
- Creating a second account with an existing phone leaves an admin-visible signal (user detail note and/or duplicates report inclusion) without changing the runner-facing flow.
- No user-facing message reveals whether a phone exists in the system.
- typecheck/lint/build pass.
