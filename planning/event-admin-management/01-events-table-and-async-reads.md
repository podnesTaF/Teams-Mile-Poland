# Slice 01 — `events` table, seed, and an async read layer

Size: L. Dependencies: none. **Behaviour-neutral: when this lands the site must look and behave exactly as before.**

## Background

`src/lib/events/registry.ts` is the single source of truth today: a literal `EVENTS: EventSummary[]` with four entries (`warsaw-2026` team/completed, `mile-2026-08-01` completed, `mile-2026-08-15` completed, `mile-2026-08-22` and `mile-2026-08-29` registration_open) plus ~13 synchronous selectors over it. Precedent for the move already exists in the same folder: `src/lib/events/media-config.ts` and `src/lib/events/results-data.ts` are DB-backed readers keyed by `event_slug` text, request-cached with React `cache`, and deliberately forgiving when the DB is missing.

This slice moves the *event records* into a table and leaves in `registry.ts` only what is genuinely config: the imported results sheets, `buildMileTimetable()`/`firstHeatTime()`, and the series defaults.

## Steps

### 1. Schema — `src/db/schema/events.ts`

```
event_status  enum: upcoming | registration_open | registration_closed | completed
              (draft + cancelled are added in slice 02 — keep this slice value-identical)
event_type    enum: individual | team
events (
  slug                   text primary key,
  status                 event_status not null,
  event_type             event_type   not null,
  name                   text not null,
  date                   date not null,          -- drizzle `date({ mode: "string" })`
  start_time             text,                   -- "HH:MM", null for legacy team event
  end_time               text,
  venue                  text not null,
  city                   text not null,
  bib_pool               integer not null default 50,
  heat_interval_minutes  integer not null default 10,
  created_at, updated_at timestamptz not null default now(),
  created_by             text                    -- users.id, null for seeded rows
)
```

`date` **must** come back as `"YYYY-MM-DD"` — `EventSummary.date` is compared with `localeCompare` for ordering and parsed by `parseDateOnly`, so `mode: "string"` preserves the existing contract exactly. `shortDate` (`"01 · 08 · 2026"`) is derived in the mapper, not stored. Export from `src/db/schema/index.ts`.

### 2. Migration `0020_*`

Generate the DDL with drizzle-kit, then hand-append the seed `INSERT`s for the four current registry rows (idempotent: `on conflict (slug) do nothing`) so preview/prod get identical data with no manual step. Document the hand edit in a header comment — the repo does this elsewhere. Check `when` in `src/db/migrations/meta/_journal.json` against the live watermark before applying; a migration older than the watermark is skipped silently.

Seed values come straight from the current registry — `MORNING = 09:15–12:15`, `EVENING = 17:30–20:30`, `bibPool 50`, `heatInterval 10`, venue/city from `EVENT.venue`. `warsaw-2026` seeds with `event_type = 'team'`, null window, its own name/date/`shortDate` source values.

### 3. New reader — `src/lib/events/store.ts`

One cached query, every selector a pure filter over it (there are five events; N queries would be worse and would break the selectors' shared-snapshot semantics):

```ts
const loadEvents = cache(async (): Promise<EventSummary[]> => { … });
```

- Maps rows → `EventSummary`, deriving `shortDate`, `timeRange` (when both times present), `timetable` (`buildMileTimetable(start)` for individual events with a window), and `results` from the config sheet map.
- Forgiving like `media-config.ts:44-48`: no `db` or a failed query → `[]` + `console.error`. Additionally, log one loud warning when the list is empty (a build with no `DATABASE_URL` would otherwise produce an event-less site that looks intentional).
- Re-export every existing selector name, now async, with identical semantics — including `getFeaturedEvent`'s open-first preference (`registry.ts:80-87`), `getIndividualEvents` including completed nights, and `getSeriesEvents` excluding them. Keep the existing docblocks; they explain *why* each selector exists and those reasons don't change.
- `getEventOrThrow` stays (currently unused, but it is the loud variant).

Keep the import path stable: `@/lib/events/registry` should continue to export the selectors (re-exporting from `store.ts`) so the ~46 consumer files change only by gaining `await`. `registry.ts` itself keeps `RESULTS_SHEETS` (slug → imported `EventResults`), the `MORNING`/`EVENING` windows as form defaults, and the series defaults; delete the `EVENTS` literal and the `mileEvent()` builder.

### 4. Make the call sites async

`grep -rn "getEventBySlug(\|getBibPool(\|getIndividualEvents(\|getSeriesEvents(\|getFeaturedEvent(\|getPastEvents(\|getHeatIntervalMinutes(\|getFirstHeatTime(\|isRegistrationOpen(" src` — 65 sites, nearly all a one-word change. The four that need thought:

1. `src/features/admin/components/shell/admin-nav.ts:83` — `buildAdminNav` becomes `async`; its caller (`admin/layout.tsx:40`) already awaits.
2. `src/features/admin/flash.ts:143,210` — **do not** make the copy registry async. Add `bibPool?: number` to `FlashContext` (`flash.ts:63`) and have the pages that render `<AdminFlash context={…}>` pass it; they are async server components. `resolveFlash` stays synchronous.
3. `generateStaticParams()` in `events/[slug]/page.tsx:49`, `events/[slug]/heats/page.tsx:29`, `events/[slug]/gallery/page.tsx:24` — become `async`. `dynamicParams` stays default `true`.
4. `src/app/[locale]/layout.tsx:83` — inside `generateMetadata`, already async.

`src/features/admin/components/ticket-admin-panel.tsx:62` is an async server component despite the `components/` path — just `await`.

### 5. Revalidation seam

Add `src/features/admin/events-revalidate.ts` (or extend the existing helpers) with one function that invalidates everything an event record feeds, for slices 02/03 to call:

```
revalidatePath("/[locale]", "page")                       // landing: featured event, series cards
revalidatePath("/[locale]/events/[slug]", "page")
revalidatePath("/[locale]/events/[slug]/heats", "page")
revalidatePath(adminPath(locale, "/events"))
revalidatePath(adminPath(locale, `/events/${slug}`))
```

Mirrors `media-actions.ts:38-40` and `results-actions.ts:148-156`. Nothing calls it yet in this slice.

### 6. Empty-state copy

`admin/events/page.tsx:59-69` tells the admin to edit `registry.ts` and deploy. It is now wrong. Point it at the create page slice 03 adds (a plain sentence for now — no dead link).

## Acceptance

- `npm run typecheck && npm run lint && npm run build` green; the build emits the same event pages as before (compare page count against the previous build).
- Every public surface is byte-for-byte unchanged in behaviour: landing featured event + series cards, `/events/mile-2026-08-22` detail, a completed night's results + gallery, `/tickets/[id]`.
- Admin unchanged: events index cards, per-event header/tabs, roster, heats (bib pool still 50), check-in, mailings segment picker.
- Migration applied on a Neon branch first; `select * from events` returns the four seeded rows with `date` as `YYYY-MM-DD`.
- One request renders one `events` query (React `cache` working) — check with a query log or `verbose` drizzle locally.
- Grep clean: no `EVENTS` literal import left, no remaining sync `getEventBySlug(` call.
