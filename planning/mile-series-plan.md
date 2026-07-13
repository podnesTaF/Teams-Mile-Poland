# ABM Mile Series: Multi-Event + User Profiles + Check-in

## Context

The site currently serves one completed team event (`warsaw-2026`) with a config-driven event registry (`src/lib/events/registry.ts`) and a frozen legacy registration stack (teams/runners/slot_counter tables, magic links, Stripe 50 PLN flow). The organizer is now running a series of **5 individual mile events** at the same stadium (Stadion Podskarbińska, Warsaw):

| Slug | Date | Time | Status at launch |
|---|---|---|---|
| `mile-2026-08-01` | 2026-08-01 | 9:15–12:15 | registration_open |
| `mile-2026-08-08` | 2026-08-08 | 17:30–20:30 | registration_open |
| `mile-2026-08-15` | 2026-08-15 | 9:15–12:15 | upcoming |
| `mile-2026-08-22` | 2026-08-22 | 17:30–20:30 | upcoming |
| `mile-2026-08-29` | 2026-08-29 | 9:15–12:15 | upcoming |

New requirements (user-confirmed decisions):
- **Capacity per event: 30 free + 20 paid slots at 5 PLN via Stripe** (Stripe PLN minimum is 2 PLN — fine).
- **User accounts**: email+password **and** Google OAuth; email verification required. Profile fields (separate): first name, surname, date of birth, sex, running club (**free-text field — no team entity** for these events; heat grouping is manual).
- **Personal profile page** with user data + their registrations/tickets.
- **Check-in by staff via admin panel**: find runner (search/QR), assign bib, mark checked-in; mark no-shows.
- **Per-event timetables** shown on the site.
- Legacy warsaw-2026 pages (results, /team, /join, /ticket) keep working untouched.

## Architecture decisions

1. **Auth: Better Auth** with Drizzle adapter. Minimal Next surface (one catch-all route handler + `nextCookies()` plugin using async `cookies()` — matches this custom Next 16.2.6 build), no dependency on middleware (this build uses `proxy.ts`). Email+password, Google, email verification (hooked to existing Resend), profile fields via `user.additionalFields`. Auth tables hand-written in `src/db/schema/` so **drizzle-kit stays the only migration tool**. Existing HMAC sessions stay for admin + legacy team flows. Route protection enforced in **server pages/actions** via `auth.api.getSession({ headers: await headers() })`, not in proxy.ts.
2. **Events stay in the config registry** (extended), not a DB table. Only mutable operational state (registrations, counters, pending checkouts) goes to DB, keyed by `event_slug text` (no FK). Caps/prices come from config into atomic `UPDATE … WHERE claimed < cap` — the same pattern as today's `createFreeRegistration`.
3. **Legacy tables frozen** — no backfill of users from old runners, no changes to existing tables. All migrations purely additive.
4. **Participation lifecycle**: `registered → checked_in | no_show` (+ `cancelled` for admin corrections). Bib = integer unique per event (partial unique index), assigned at check-in; UI suggests `max(bib)+1`, allows manual entry, retries on unique violation.
5. **Paid slots are claimed at checkout creation and released on expiry** (new vs legacy: legacy paid was uncapped). `checkout.session.expired` webhook + cron sweep release abandoned claims.

## Next.js 16.2.6 constraints (custom build — see `node_modules/next/dist/docs/`)

- `params`/`searchParams`/`cookies()`/`headers()` are **async-only**; use `PageProps<'/route'>` helpers.
- `proxy.ts` (already exists, next-intl only) — do not add middleware.ts.
- `revalidateTag(tag, 'max')` needs 2nd arg; `updateTag()` in server actions; never wrap session/counter reads in `'use cache'`.
- Parallel route slots need explicit `default.tsx` (existing `@modal` slot — check when touching `[locale]` routes).

## DB schema (new files in `src/db/schema/`, export from `index.ts`)

```ts
// auth.ts — per Better Auth Drizzle adapter; VERIFY shape against
// `npx @better-auth/cli generate` output before writing migration.
users: id text PK, name, email unique, emailVerified bool, image,
  // additionalFields:
  firstName, lastName, dateOfBirth date, sex pgEnum('user_sex',['M','F']),
  club text, phone, locale text default 'pl', createdAt, updatedAt
sessions / accounts / verifications — standard Better Auth tables

// event-registrations.ts
participationStatusEnum = pgEnum("participation_status",
  ["registered","checked_in","no_show","cancelled"])
eventRegistrations: id uuid PK, eventSlug text, userId → users.id,
  status default 'registered', bib integer, paymentStatus (reuse existing enum),
  freeSlot bool, stripeSessionId, terms bool, locale, checkedInAt, createdAt
  + uniqueIndex(eventSlug, userId)
  + uniqueIndex(eventSlug, bib) WHERE bib IS NOT NULL

// event-counters.ts — per-event version of slot_counter
eventSlotCounters: eventSlug text PK, freeClaimed int, paidClaimed int, updatedAt
  // claim: UPDATE … SET free_claimed = free_claimed+1
  //        WHERE event_slug=$s AND free_claimed < $capFromConfig RETURNING …
  // rows seeded lazily: INSERT … ON CONFLICT DO NOTHING before claim

// pending-event-registrations.ts
pendingEventRegistrations: id uuid PK, eventSlug, userId,
  stripeSessionId unique, locale, expiresAt (15 min), createdAt
  // deletion always pairs with paidClaimed decrement in same transaction
```

Migrations: `0005` (auth tables), `0006` (event registration tables) via `npm run db:generate`. Apply to a **Neon branch first**, then prod.

## Registry/type extensions

`src/lib/events/types.ts` — extend `EventSummary`:
```ts
eventType: "team" | "individual";
timeRange?: { start: string; end: string };   // "09:15" local
capacity?: { free: number; paid: number };    // 30 / 20
pricePln?: number;                            // 5
timetable?: TimetableBlock[];                 // heats in the 3h block, i18n label keys
```
`src/lib/events/registry.ts` — add the 5 events; new selectors `getOpenEvents()`, `getUpcomingEvents()`, `getEventBySlug()` / `getEventOrThrow()`. Keep `getFeaturedEvent()` for hero.

## Implementation phases (each leaves the site deployable)

### Phase 1 — Event series model + public pages (no auth)
- Extend `types.ts` + `registry.ts` (events start as `upcoming`); timetable config in `src/lib/events/timetables/` (shared template fn — same stadium, two time patterns).
- `src/app/[locale]/events/[slug]/page.tsx` — detail: date/time, venue (reuse `EVENT.venue` from `src/lib/marketing/event.ts`), timetable, capacity meter, register CTA (disabled "opens soon" until Phase 4). `generateStaticParams` from registry.
- `src/components/landing/event-series.tsx` cards section; wire into `landing-view.tsx`; point hero/`register-cta.tsx` at featured event's `/events/[slug]`.
- i18n: `events` namespace in `src/messages/{pl,en,ua}.json`.

### Phase 2 — Better Auth + profile
- `npm i better-auth`; `src/db/schema/auth.ts`; migration 0005.
- `src/lib/auth/better-auth.ts` — betterAuth({ drizzleAdapter, emailAndPassword + requireEmailVerification, emailVerification → Resend (`src/emails/verify-email.tsx`, reuse `src/emails/components.tsx` patterns), socialProviders.google, user.additionalFields, plugins: [nextCookies()] }).
- `src/lib/auth/auth-client.ts` (createAuthClient); `src/app/api/auth/[...all]/route.ts` (toNextJsHandler). Note: proxy matcher already excludes `/api`.
- **Spike-verify auth works on this custom Next 16 before building UI on it** (sign-up/sign-in round trip). Fallback: Better Auth core + thin cookie bridge over existing `src/lib/auth/session.ts` HMAC helpers.
- Auth pages under `src/app/[locale]/auth/`: sign-in, sign-up, verify-email, forgot/reset-password (react-hook-form + zod, existing form styles).
- `src/lib/auth/user-session.ts` — `getUser()` / `requireUser()` / `isProfileComplete()`.
- `src/app/[locale]/profile/page.tsx` + `src/features/profile/{actions,schemas,components}` — profile form (firstName, lastName, DOB, sex, club, phone). Header gets sign-in/profile link.

### Phase 3 — Event registration + payment + tickets
- Schema files + migration 0006.
- `src/features/event-registration/data.ts` — `claimFreeSlot`/`claimPaidSlot`/`releasePaidSlot`, `createRegistration`, `promotePendingEventRegistration` (idempotent, mirror `src/features/registration/data.ts` promotePendingRegistration), `getEventCounters`, `getUserRegistrations`.
- `src/features/event-registration/actions.ts` — `registerForEvent(slug)`: guards (session + emailVerified + profile complete + `registration_open` + no dup — unique index backstop); free path → insert + ticket email; paid path → claim paid counter → Stripe checkout (5 PLN, metadata `{ kind: "event_registration" }`) → pending row; release counter on Stripe error.
- `src/app/api/stripe/webhook/route.ts` — branch on `metadata.kind`; handle `checkout.session.expired` → delete pending + release paid counter. **Legacy path literally unchanged.**
- Tickets: add `signEventTicket(registrationId)` in `src/features/ticket/sign.ts` (distinct purpose string); `src/app/[locale]/tickets/[registrationId]/page.tsx`; QR via existing `src/features/ticket/qr.ts`; `src/emails/event-ticket.tsx` confirmation.
- `src/app/[locale]/events/[slug]/register/page.tsx` — auth-gated confirm page (summary + terms + submit; success/cancel states). Live capacity on event detail.
- Profile "My registrations" list (event, status, payment, ticket link).
- `src/app/api/cron/cleanup/route.ts` — sweep expired pending rows + release paid slots (CRON_SECRET-guarded).

### Phase 4 — Go live
- Flip `mile-2026-08-01` + `mile-2026-08-08` to `registration_open`; landing features soonest open event.

### Phase 5 — Admin check-in & roster
- `src/features/admin/events-data.ts` — roster query (event_registrations ⋈ users), search name/email/bib, `suggestNextBib(slug)`.
- `src/features/admin/checkin-actions.ts` — admin-session-guarded: `assignBibAndCheckIn(regId, bib)` (transaction, retry on unique violation), `markNoShow`, `revertToRegistered`.
- `src/app/[locale]/admin/events/[slug]/page.tsx` — roster + status filters + XLSX export (extend `src/features/admin/export-runners.ts` pattern; include DOB/sex/club + age category computed from `AGE_CATEGORIES` config).
- `src/app/[locale]/admin/events/[slug]/checkin/page.tsx` — search + QR scan (decode ticket URL → registrationId+sig, verify server-side) + bib input pre-filled with suggestion; check-in / no-show buttons. Legacy `/api/ticket/check-in` stays.
- Admin home links to per-event pages.

### Phase 6 — Mailings generalization (post-launch follow-up)
Current `src/features/mailings/schedule.ts` is hardcoded to 2026-06-27. Parameterize by event date/timeRange from the registry; drop captain-nudge for individual events; key `email_log` idempotency by (eventRegistrationId, kind). **Until then: keep the lifecycle cron scoped to legacy runners only** so it can't email new-event participants.

## New env vars
`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (or derive from `NEXT_PUBLIC_APP_URL`), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`. Reuse existing: `DATABASE_URL`, `RESEND_API_KEY`, `STRIPE_*`, `SESSION_SECRET`, `ADMIN_PASSWORD`, `CHECKIN_API_KEY`, `CRON_SECRET`. Stripe dashboard: subscribe webhook to `checkout.session.expired`; Google console: redirect URI `…/api/auth/callback/google`.

## Verification (per phase)
1. `npm run typecheck && npm run lint && npm run build` — build is the guard for custom-Next pitfalls (async params, `@modal` `default.tsx`, no `'use cache'` around session reads).
2. Migrations on Neon branch; confirm legacy tables untouched.
3. Auth: sign-up → Resend verification arrives → unverified blocked from registering → Google sign-in → profile-completeness gate.
4. Registration: concurrent-burst claim of 30 free slots holds cap; 31st → Stripe; `stripe listen --forward-to localhost:3000/api/stripe/webhook` → completed promotes + ticket email with scannable QR; abandoned checkout releases paid counter; duplicate registration rejected.
5. Check-in: search/QR → bib suggested → assigned; duplicate bib rejected; no-show flips status; XLSX has new fields.
6. All 3 locales render new pages; legacy `/join/[code]`, `/team/[code]`, `/ticket/[runnerId]`, results section still work.

## Risks
- **Better Auth × custom Next 16.2.6** — biggest unknown; de-risked by the Phase 2 spike before dependent UI. Fallback documented above.
- Paid-slot leakage on abandoned checkouts — expired webhook + cron sweep; monitor paidClaimed vs paid rows.
- Webhook regression for legacy flow — branch only on new metadata, don't touch legacy path.
- Bib races — partial unique index is source of truth; UI retries.

## Progress log
- 2026-07-12 — PRD #7 slice 1 (issue #9): additive migration 0010 (`legacy_participations`, `user_broadcasts`, `user_broadcast_log`, `users.marketing_opt_out`) + one-time first-event import script (`npm run import:first-event`, dry-run default / `--write`). Dry-run against live data: 83 runners → 78 unique emails (66 new users, 12 existing attach-only), 13/23 results entries matched, 10 unmatched (on-site heat 3 + Cyrillic-registered names), 0 ambiguous. Migration apply + `--write` + idempotency re-run still need a Neon branch (no neonctl here).
- 2026-07-13 — PRD #7 prefactor slice (issue #8): admin monolith split into `/admin` (stat cards + series table w/ per-event registration counts), `/admin/inquiries`, `/admin/legacy` (frozen warsaw-2026 teams/runners + exports), `/admin/users` stub; shared `AdminShell` nav on all admin pages (incl. mailings, roster, check-in) with router-aware `Link`s — the old `<a>` static-export lint errors are gone. Feature module split: `action-helpers` / `inquiries-*` / `legacy-*` / `overview-data` + shared `format`/`Stat`/`StatusPill`/`DownloadLink`/`NoDatabaseNotice`. Fixed latent FK crash: `deleteTeamCascade` now detaches `broadcasts.team_id` before deleting a team. Verified live: login → overview → inquiries → legacy → users → roster/check-in over HTTP; unauthenticated requests stream a redirect with no data leak.
- 2026-07-13 — Issue #9 executed on the **live DB** (owner's call): `db:migrate` applied 0009 (pending `confirmation` enum value that had never reached live) + 0010; `--write` created 66 users / 78 participations (13 attended), re-run was a full no-op, and a field-by-field snapshot diff confirmed zero profile changes on the 19 pre-existing users. Issue #9 closed. Claim-flow caveat for the broadcast slice: imported passwordless users dead-end on plain `/auth/sign-up` and Google sign-in (`account_not_linked`); broadcast copy must link to the events register flow (guest-registration resend path), per the PRD.
- 2026-07-13 — PRD #7 slice (issue #10): user management on top of #8/#9 — `/admin/users` (search + four combinable filters: verified, first-event attendance, Aug-registered), `/admin/users/[id]` (profile + legacy⋃series history unioned chronologically), and `deleteUser` (FK cascade, confirm dialog) + `resendUserVerification` (Better Auth send-verification → `/events`, unverified-only). New `users-data.ts` / `users-actions.ts`; reuses the admin shell + table/pill/confirm/no-db idioms. Data layer + delete cascade verified against a Neon branch (filter partitions sum, combined filter + search narrow correctly, unioned history renders, throwaway-user delete cascaded participation + registration). Resend email not fired live (avoids messaging a real imported person); path is identical to the proven `registerAsGuest` resend. Branch `feat/admin-users-management`, commit `cef46a3`; issue #10 closed. Next: participant management (#12) and broadcasts/unsubscribe (#11) are already in-flight in the working tree.
