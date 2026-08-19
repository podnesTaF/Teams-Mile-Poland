# Task 14 — Referral admin drill-down (optional polish)

Size: M. Dependencies: task 11 (participation definition) ideally first. Priority: low — referral core is done; do this only after tasks 01–13 or on client request.

## Background
Referral core shipped in `508ad15`: codes/links (`src/features/referral/data.ts`), attribution hook (`src/lib/auth/better-auth.ts:152-166`), profile section (`profile/page.tsx:423-452`), admin totals + per-referrer table at `/admin/referrals` (`src/features/admin/referrals-data.ts:22-45`, page `src/app/[locale]/admin/referrals/page.tsx`). Missing depth:
- No list of *who* a referrer invited; no per-event breakdown; no pagination/export.
- `/admin/users/[id]` shows nothing about referrals (neither "referred by X" nor "invited N people").
- Attribution edge: guest registration under an existing email updates the user in place (`event-registration/actions.ts:185-190`) — no user-create hook fires, so the referral cookie is lost. Optional fix: apply `applyReferralAttribution` (`referral/data.ts:75-90`, first-writer-wins) in that path too.

## Steps
1. Referrer detail: `/admin/referrals/[id]` (or expandable rows) listing referred users — name, email, signed-up date, registrations, checked-in count — each linking to `/admin/users/[id]`. Data: extend `referrals-data.ts` with a `listReferredUsers(referrerId)`.
2. User detail cross-links: on `/admin/users/[id]` show "Referred by <name>" (from `users.referred_by`) and "Invited N people" linking to the referrer detail.
3. Guest-flow attribution fix (small, self-contained — keep in this task): in the existing-email guest path, read the `ref` cookie and call `applyReferralAttribution`; first-writer-wins semantics make this safe.
4. Optional if time permits: CSV export of the referrer table (pattern: `src/features/admin/export-runners.ts`).

## Acceptance
- Admin can navigate referrer → invited users → user detail and back.
- A guest registration with an existing unattributed email + ref cookie sets `referred_by`.
- Existing `/admin/referrals` totals unchanged for untouched data.
- typecheck/lint/build pass.
