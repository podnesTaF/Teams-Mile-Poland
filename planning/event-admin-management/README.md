# Plan — admin-managed events (create + lifecycle)

Goal: an admin creates an event and moves it through its lifecycle from `/admin`, with no code edit and no deploy.

Today events are **compile-time config**: `src/lib/events/registry.ts` exports a literal `EVENTS: EventSummary[]`, and ~65 call sites across 46 files read it through synchronous selectors (`getEventBySlug`, `getIndividualEvents`, `getBibPool`, …). The admin events index says so out loud in its empty state: *"Mile-series events are configuration, not rows"* (`src/app/[locale]/admin/events/page.tsx:65`). So the feature is not an admin form — it is **making events data**, and the form is the last slice.

## Decisions taken (2026-08-20, with the owner)

| Question | Decision |
|---|---|
| Where do events live? | One `events` table = single source of truth, seeded from the current registry. `registry.ts` keeps only derived config: the results sheets by slug, `buildMileTimetable()`, venue/pool defaults. |
| Lifecycle states | Add **`draft`** (admin-only, 404 publicly) and **`cancelled`** (public page says cancelled, registration refused, history kept) to the existing four. |
| Admin-editable fields | Name, date, start/end window, venue, city, event type, bib pool, heat interval, status. Timetable stays **generated** from the start time — every night in the series runs the same flow. |
| Deletion | Hard delete only while the event has zero registrations / results / heats / media / email-log rows. Otherwise the exit is `cancelled` — the slug is the join key for six tables with no FKs, so deleting a used slug strands rows (exactly what the 08-08 cancellation had to work around by re-slugging 11 registrations by hand). |

Two further calls made in-plan rather than asked, both following existing repo idiom:

- **Public pages stay SSG + on-demand ISR.** `generateStaticParams()` becomes an async DB read; `dynamicParams` stays at its default `true`, so an event created after the last deploy renders on first request (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/02-route-segment-config/dynamicParams.md`). Every event mutation calls `revalidatePath`, the same way `media-actions.ts:38-40` and `results-actions.ts:148-156` already flip the landing and event pages without a deploy. No page becomes `force-dynamic`.
- **Slug is generated once and immutable.** `mile-<date>` at creation (collision-suffixed), never rewritten on edit — six tables key off it. Moving a date therefore leaves the slug reading the old date; that is the cheap, safe trade and the admin UI states it.

## Slices

| # | Slice | Size | Depends on | Ships as |
|---|---|---|---|---|
| [01](01-events-table-and-async-reads.md) | `events` table + seed + async read layer | L | — | Invisible refactor: identical site, events now rows |
| [02](02-draft-cancelled-and-status-action.md) | `draft` + `cancelled` states, status-change action | M | 01 | Admin can move an event through its lifecycle |
| [03](03-create-edit-delete-event.md) | Create / edit / delete event | M | 01, 02 | The actual feature |
| [04](04-side-effects-and-verification.md) | Side-effect audit + end-to-end verification + ADR | M | 03 | Confidence + written-down decisions |

Slice 01 is deliberately behaviour-neutral and self-contained: it lands, the site looks the same, and nothing new is exposed. Everything after it is small.

## Why slice 01 is the expensive one

The read layer is synchronous everywhere. Going to the DB makes it async, which touches:

- **38** `getEventBySlug()` call sites, **11** `getBibPool()`, plus `getIndividualEvents`/`getSeriesEvents`/`getFeaturedEvent`/`getPastEvents` (`grep -rn "getEventBySlug(\|getBibPool(" src`). Nearly all are already inside `async` server components, server actions, or route handlers, so they take an `await` and nothing else.
- The three genuinely sync callers, which need a shape change rather than an `await`:
  - `buildAdminNav(role)` (`src/features/admin/components/shell/admin-nav.ts:83`) → async; its one caller `src/app/[locale]/admin/layout.tsx:40` already awaits.
  - `resolveFlash` / `AdminFlash` (`src/features/admin/flash.ts:143,210`, `src/features/admin/components/admin-flash.tsx`) — the copy builders are `(query, ctx) => string`. Do **not** make the copy layer async: add `bibPool?: number` to `FlashContext` and let the calling page (already async) resolve it.
  - `generateStaticParams()` on `/events/[slug]` and `/events/[slug]/{heats,gallery}` → async.
- `EventStatus` is used as an exhaustive `Record` key in three places (`event-status-badge.tsx:14,21`, `admin/events/[slug]/page.tsx:184`) and switched on in two (`events/[slug]/page.tsx:30`, `series-list.tsx:19`). Adding two statuses in slice 02 makes the compiler enumerate the work — that is the intended safety net, so keep those `Record<EventStatus, …>` types (do not loosen them to partials).

## Risks and how each is handled

- **Build now depends on the database for the event list.** `getPublicResults` already reads the DB during `next build` for SSG event pages, so CI/Vercel builds have `DATABASE_URL` — but a local `npm run build` without `.env.local` would silently produce a site with zero event pages and no featured event. Reads stay forgiving (empty list + `console.error`, like `media-config.ts:44-48`) *and* slice 01 logs one loud build-time warning when the event list comes back empty, so "no events" can never read as normal.
- **Registration must not open by accident.** `registerForEvent` already refuses anything but `registration_open` (`src/features/event-registration/actions.ts:75`), so `draft` and `cancelled` are refused the moment the enum grows. The gap is visibility, not entry: `EventRegisterContent` renders a `LifecycleNotice` for non-open events (`event-register-content.tsx:41`) — a `draft` must `notFound()` there instead of advertising an unannounced night.
- **Moving a date moves the mailing schedule.** `event-mailings/schedule.ts` derives reminder send times from the event's date + window, and `event_email_log` makes each kind idempotent per registration. Pulling a date *earlier* can make a reminder instantly due; pushing it *later* cannot un-send one already logged. Slice 04 audits this and the edit form warns when the moved event has reminders already sent.
- **Bib pool shrinking below assigned bibs.** Bibs are leases from `1..bibPool` (ADR 0003). Editing the pool down must be refused when a higher bib is currently held, not silently accepted.
- **Migration watermark.** The next migration is `0020`. A generated migration whose `when` in `src/db/migrations/meta/_journal.json` predates the live watermark is skipped in silence — check it before applying (this bit us once already).

## Ground rules inherited

Read `node_modules/next/dist/docs/` before writing Next code (custom Next 16.2.6). Migrations additive-only, Neon branch first, watermark checked. Admin UI English-only; public UI trilingual with pl/en/ua key parity. `npm run typecheck && npm run lint && npm run build` before calling a slice done. This checkout is shared by several sessions — check mtimes before committing, never `git add -A`.
