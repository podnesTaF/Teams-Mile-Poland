# Task 03 — Verify the Google sign-in fix + regression guard

Size: S. Dependencies: none.

## Background
Imported passwordless users used to dead-end with `account_not_linked` on Google sign-in (problem recorded in `planning/mile-series-plan.md:144`). Commit `508ad15` fixed it in `src/lib/auth/better-auth.ts:146-150`:
```ts
accountLinking: { enabled: true, trustedProviders: ["google"], requireLocalEmailVerified: false }
```
Against better-auth 1.6.23 internals (`node_modules/better-auth/dist/oauth2/link-account.mjs`) all refusal clauses are now false for a passwordless user with `emailVerified: false`, so Google links to the existing row and flips `emailVerified: true`. The fix was never verified live, has no test, and no phase-log entry. Risk: `requireLocalEmailVerified` is deprecated upstream (see the comment at `better-auth.ts:142-145`) — a minor version bump can silently re-break the flow.

## Steps
1. Live-verify three paths (dev server + real Google OAuth, or a driven browser): (a) imported passwordless user (`emailVerified: false`, no account row) signs in with Google → account linked, `emailVerified` flipped, no duplicate user; (b) existing email+password user → linked, password still works; (c) brand-new user → created with `firstName`/`lastName` mapped via `mapProfileToUser` (`better-auth.ts:117-129`). Use throwaway/branch data, not real imported people.
2. Add a regression guard: either pin `better-auth` to an exact version in `package.json` with a comment, or (better) a small test/startup assertion that the resolved auth options still contain `trustedProviders: ["google"]` and linking-enabled semantics.
3. Improve observability: the `?error=` bounce renders one generic `errors.oauthCallback` message (`src/features/auth/components/sign-in-form.tsx:25-27`); at minimum log the specific error code server-side or in the `google-button.tsx` error path.
4. Add a dated entry to the phase log in `planning/mile-series-plan.md` recording root cause + fix + verification (the log currently records only the problem).

## Acceptance
- All three sign-in paths verified and documented (case a is the critical one).
- Regression guard in place; typecheck/lint/build pass.
- Phase-log entry added.
