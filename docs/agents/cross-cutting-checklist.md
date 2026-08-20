# Cross-Cutting Checklist

Walk this list for every feature. It captures the concerns that recur across this codebase and are the expensive things to get wrong. Record a decision for each item that applies; mark the rest "n/a" explicitly.

This is a **single Next.js 16 app** (App Router, i18n pl/en/ua, Drizzle + Neon, Better Auth, server actions). There is no mobile/backend/worker split — "surface" from generic pipelines maps to an **area** within this one app (see `issue-tracker.md`).

## 1. Trilingual i18n

Every user-facing string on the public site ships in **all three** message catalogs: **pl, en, ua**. Decide which namespaces are touched and add keys to all three. Missing a locale is a bug, not a follow-up.

**Admin (`/admin/*`) is English-only** by convention — do not add pl/ua there.

## 2. Auth gating

Classify each action as **public / user-gated / admin-gated**.

- User-gated actions follow the gate chain: guest → `/auth/sign-up?redirectTo=<url>` → verify-email → profile (`isProfileComplete`) → action. Thread `redirectTo` through **every** hop (sign-up, verify, profile) so intent survives round-trips. Email `callbackURL` must also carry `redirectTo`.
- Admin actions run through the admin guard and live under `/admin/*`.
- Use `getUser` / `requireUser` / `isProfileComplete` from `src/lib/auth/user-session.ts`.

## 3. Flow states

For each new screen/flow, decide which of these render and how: **signed-out (gated?)**, **loading**, **empty**, **error**, and the relevant **event-lifecycle state** — `draft` / `upcoming` / `registration_open` / `registration_closed` / `completed` / `cancelled`. A `draft` is **404 on every public surface** (it is unannounced); a `cancelled` event's public page renders with a cancelled banner and refuses registration. Server-render the lifecycle state from the event row (an `await`ed store read); only live-changing values (e.g. counters, if reintroduced) belong in a client island. A flow isn't done with only its happy path.

## 4. SSG / static export

Event and public pages are **statically generated** (e.g. events × 3 locales) and stay that way now that events are rows: `generateStaticParams()` is an async DB read, `dynamicParams` keeps its default `true` (an event created after the last deploy renders on first request), and every mutation revalidates — no event page is `force-dynamic` (ADR 0005). For new public pages, decide SSG vs dynamic and honor the export constraints (static-export flags `<a>` links in lint — pre-existing in `admin/page.tsx`). **When you delete or rename a route, clear `.next` before rebuilding** — the stale types validator references removed routes and fails the build otherwise.

## 5. Data model & migrations

- **Events are data, not config** (ADR 0005). They are rows in the `events` table (`src/db/schema/events.ts`), read through `src/lib/events/store.ts` — which `registry.ts` re-exports, so the import path is unchanged and **every selector is `async`**. **Adding an event is an admin action** (`/admin/events/new` → the event lands as `draft`): no code edit, no deploy. What is left in `registry.ts` is genuine config — the `MORNING`/`EVENING` window defaults and the venue defaults; the hand-transcribed results sheets live in `results-sheets.ts`, and the timetable is derived from the start time, never stored.
- DB tables are still keyed by **`event_slug` text (no FK to `events`)** — deliberately: the slug is the stable join key for six tables and the admin delete-guard handles a used event explicitly (refuse + offer `cancelled`) rather than leaving it to a cascade.
- Adding an event **status** needs no migration: `status`/`event_type` are `text` + `$type<>`, not pgEnums (`ALTER TYPE … ADD VALUE` stranded migration 0012 on the live DB). The compiler is the safety net — keep the `Record<EventStatus, …>` maps total.
- Migrations are **additive-only**. Generate with `drizzle-kit generate`, then read the emitted SQL before committing.
- Legacy `teams` / `runners` / `slot_counter` tables are **frozen** — never migrate or repurpose them; new event features use the `event_*` tables.

## 6. Route-intercepting modal + fallback page

User-facing flows (auth, register) are built as `@modal/(.)…` intercepting routes with a hard-load full-page fallback that shares the same content component. New flows of this shape follow the pattern (shared content component; modal shell reuses `.auth-overlay`).

## 7. Reuse targets

Before adding new machinery, reach for existing idioms:

- Forms: plain `useState` + `.iv-*` / `FloatField` (auth forms deliberately do **not** use react-hook-form).
- Styling: `.auth-*` / `.acl-*` tokens in `series-flows.css`, `landing.css`.
- Auth: `authClient` methods (`signUp.email`, `signIn.email`, `useSession`, `requestPasswordReset`, …).
- Events: selectors `getOpenEvents` / `getUpcomingEvents` / `getSeriesEvents` / `getEventBySlug` / `getEventOrThrow` — all `async`, all filters over one request-cached snapshot (`store.ts`); never add a per-selector query. Mutations call `revalidateEventSurfaces()`.
- Registration/tickets: `src/features/event-registration/*`, signed-ticket helpers in `ticket/sign.ts`.

## 8. Emails

React Email templates in `src/emails/`, copy in all three locales, sends logged **idempotently** (unique per `(event_registration_id, kind)` in `event_email_log`). Dispatched from cron routes guarded by `CRON_SECRET`. The legacy team mailing module is frozen — build event mailings in the parallel `src/features/event-mailings/` module.

## 9. Verification (no test infra)

There is no jest/vitest/test runner in this repo. Verification is:

```bash
npm run typecheck   # tsc --noEmit
npm run build       # next build (also validates routes/SSG)
npm run lint        # eslint
```

plus `/verify` to drive the flow end-to-end. Pre-existing lint errors (the `admin/page.tsx` static-export `<a>` warnings) are acceptable; **do not introduce new ones**. Do not invent a test runner mid-feature.

## 10. Leanness

Anything that doesn't trace to the Problem Statement goes to **Out of Scope**. Prefer extending config/registry and existing features over new subsystems.
