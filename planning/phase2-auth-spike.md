# Phase 2 — Better Auth spike runbook

Goal: prove Better Auth works on this custom Next 16.2.6 build with a real
sign-up → email-verify → sign-in round trip **before** building auth UI on it.

## What's already in place (scaffolded, compiles, `npm run build` green)

- `better-auth@1.6.23` installed.
- `src/db/schema/auth.ts` — hand-written `users` / `sessions` / `accounts` /
  `verifications` tables (+ `user_sex` enum, profile additionalFields, indexes),
  exported from `src/db/schema/index.ts`. Shape verified against
  `npx @better-auth/cli generate`.
- `src/db/migrations/0005_odd_yellowjacket.sql` — additive-only (CREATE TYPE /
  TABLE / INDEX + FK constraints on the new tables). Legacy tables untouched.
- `src/lib/auth/better-auth.ts` — `betterAuth(...)`: drizzle adapter (pg),
  email+password with `requireEmailVerification`, `sendOnSignUp`, Google
  provider, `user.additionalFields`, `nextCookies()` plugin.
- `src/lib/auth/auth-client.ts` — `createAuthClient` + `inferAdditionalFields`.
- `src/app/api/auth/[...all]/route.ts` — `toNextJsHandler(auth)` (GET/POST).
- `.env.local` — `BETTER_AUTH_SECRET` generated; `BETTER_AUTH_URL` set;
  empty `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` placeholders.

## Run the spike

1. **Create a Neon branch** (do NOT use prod). Copy its connection string.

2. **Point drizzle-kit at the branch and apply migrations** (temporarily set
   `DATABASE_URL` to the branch URL for this command only):

   ```bash
   # PowerShell:  $env:DATABASE_URL="postgres://...branch..."; npm run db:migrate
   npm run db:migrate
   ```

   Confirm the 4 auth tables exist and legacy tables are unchanged
   (`npm run db:studio`).

3. **Run the app against the branch** (`DATABASE_URL` = branch URL):

   ```bash
   npm run dev
   ```

4. **Sign-up round trip** — no UI yet, so drive the API directly:

   ```bash
   # a) sign up (email + password + required `name`)
   curl -i -X POST http://localhost:3000/api/auth/sign-up/email \
     -H "Content-Type: application/json" \
     -d '{"email":"spike@example.com","password":"Passw0rd!23","name":"Spike Test"}'
   ```

   - Expect 200 and a user row in `users` (`email_verified=false`).
   - Verification email is sent via Resend if `RESEND_API_KEY` is set; otherwise
     the link is logged to the dev console (`[auth] verify email for …`).

   ```bash
   # b) sign in BEFORE verifying — should be blocked (403) because
   #    requireEmailVerification is on
   curl -i -X POST http://localhost:3000/api/auth/sign-in/email \
     -H "Content-Type: application/json" \
     -d '{"email":"spike@example.com","password":"Passw0rd!23"}'
   ```

   ```bash
   # c) open the verification URL from the email / console log in a browser
   #    (or GET it). autoSignInAfterVerification=true → sets the session cookie.
   ```

   ```bash
   # d) sign in AFTER verifying — should be 200 and set a session cookie
   curl -i -X POST http://localhost:3000/api/auth/sign-in/email \
     -H "Content-Type: application/json" \
     -d '{"email":"spike@example.com","password":"Passw0rd!23"}'
   ```

5. **Session read from a server component/action** — the real integration point.
   Confirm `auth.api.getSession({ headers: await headers() })` returns the user
   (async `headers()` on this build). A throwaway server action or a temporary
   `app/[locale]/auth-debug/page.tsx` that prints the session is enough.

## Pass criteria

- [ ] Sign-up creates a `users` row and a `verifications` row.
- [ ] Unverified sign-in is rejected.
- [ ] Verification link marks `email_verified=true` and (auto) signs in.
- [ ] Verified sign-in returns a session cookie; `getSession` reads it in RSC.
- [ ] Google sign-in redirects to `/api/auth/callback/google` (needs real
      `GOOGLE_CLIENT_*` + console redirect URI) — optional for the core spike.

## If it fails — documented fallback

Better Auth core + a thin cookie bridge over the existing
`src/lib/auth/session.ts` HMAC helpers (see plan §Risks). The schema and route
surface stay; only the session/cookie mechanism is swapped.

## After the spike passes

- Apply migration 0005 to prod (Neon).
- Build the auth UI: `src/app/[locale]/auth/` (sign-in/up, verify, reset),
  `src/lib/auth/user-session.ts` (`getUser`/`requireUser`/`isProfileComplete`),
  profile page + a real `src/emails/verify-email.tsx` template (replace the
  spike-grade text email in `better-auth.ts`).
