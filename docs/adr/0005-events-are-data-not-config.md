# Events are data, not config

**Context.** Which events existed and what state each was in was **compile-time config**:
`src/lib/events/registry.ts` exported a literal `EVENTS: EventSummary[]`, and ~83 call
sites across 44 files read it through synchronous selectors (`getEventBySlug`,
`getIndividualEvents`, `getBibPool`, …). Opening a race night for registration was
therefore a code edit plus a deploy, and the admin events index said so in its empty
state. The bill came due when the 2026-08-08 night was cancelled: with no `cancelled`
status in the model, the entry was **deleted from the registry outright** and its 11
registrations re-slugged to 08-15 by hand. The precedent for the fix was already in the
same folder — `media-config.ts` and `results-data.ts` are DB-backed, `event_slug`-keyed,
request-cached readers that took gallery publication out of the deploy path the same way.

**Decision.** One `events` table (`src/db/schema/events.ts`) is the single source of truth
for the event record, seeded from the registry by migration `0021_rich_toxin.sql` (DDL from
drizzle-kit, seed `INSERT`s hand-appended with `on conflict do nothing`, documented in a
header comment) so the deploy that lands the code arrives with the five events already in
place. `src/lib/events/store.ts` replaces the literal: **one** request-cached query
(React `cache`) with every selector a pure in-memory filter over that single snapshot, all
now `async`. `registry.ts` becomes a re-export shim, so the consumer files changed only
by gaining an `await`.

**What stayed config, and why.** Three things did not move:

- The two windows the series actually runs — `MORNING` (09:15–12:15) and `EVENING`
  (17:30–20:30) — plus the venue/city defaults, which are now *create-form defaults*
  rather than entries, and are referenced from `@/lib/marketing/event` rather than retyped.
- The **hand-transcribed results sheets**, moved to `src/lib/events/results-sheets.ts`
  (its own module, so `store.ts` can import them without a cycle through the shim). These
  are the pre-timing-system races whose paper sheets were typed into a TS literal: there
  is no admin flow that could have produced them and nothing to gain by migrating them.
  A slug absent from the map is not resultless — `results-data.ts` prefers `event_results`,
  where the timing system's imports land.
- The **timetable stays derived**, not stored and not editable: `buildMileTimetable(start)`
  builds it from the window's start time in `toSummary`, because every night in the series
  runs the same flow. `shortDate` and the display `timeRange` are derived there too — the
  table stores facts and nothing else.

**Slug immutability, and the six tables that force it.** The slug is generated once at
creation (`mile-<YYYY-MM-DD>`, suffixed `-2`, `-3`… on collision) and **never rewritten**.
Six things key off `event_slug` as **text with no FK** — `event_registrations`,
`event_results`, `event_heats`, `event_media`, `event_email_log`, plus the ticket signature
payload — so renaming a slug strands rows in all six at once. That is not a hypothetical:
the last slug rename in this project was the 08-08 cancellation, and it cost 11
registrations moved by hand. The accepted trade: **a date moved after creation leaves a
slug naming the old date.** The slug is an opaque join key, the edit form shows it
read-only with one line saying why, and every surface that shows a date reads the `date`
column. Cheap and safe beats correct-looking and dangerous.

**`status` and `event_type` are `text` + `$type<>`, not a pgEnum.** This is a deliberate
deviation from the plan, which called for a pg enum grown later by `ALTER TYPE … ADD VALUE`
when `draft` and `cancelled` arrived. That is the exact migration shape this repo has now
banned three times, each ban documented in the schema:

- `src/db/schema/event-results.ts:5-9` — `ResultStatus`: "plain text + `$type` rather than
  a pgEnum — `ALTER TYPE … ADD VALUE` cannot run inside a transaction and stranded
  migration 0012 on the live DB; `users.role` set the precedent this follows."
- `src/db/schema/wallet.ts:74-79` — `asset`/`kind`/`status`: same reason, "and these are
  value sets that will grow."
- `src/db/schema/auth.ts:41-45` — `users.role`: the original. "A role set is a value, not
  a type — which is also what let the admin levels ship with no migration at all."

An event's status is the same kind of thing: a value set that is *known* to be growing.
The consequence worth stating plainly is that **adding `draft` and `cancelled` needs no
migration at all** — they are a change to `EventStatus` in TypeScript and nothing else. The
type safety that actually matters here is the compiler's, not Postgres's: `EventStatus` is
used as a **total `Record` key in three places** (`EVENT_STATUS_DOT` and `STATUS_INK` in
`event-status-badge.tsx`, `EMPTY_ROSTER_COPY` in `admin/events/[slug]/page.tsx`) and
switched on in two more, so adding a value makes `tsc` enumerate the work. Keep those
`Record<EventStatus, …>` types total — do not loosen them to `Partial`; they are the
safety net that replaces the enum.

**Why public pages stayed SSG + on-demand ISR.** The obvious move once events are rows is
to make the event pages dynamic. Rejected. `generateStaticParams()` became `async` and
reads the DB; `dynamicParams` stays at its default `true`; every mutation calls
`revalidateEventSurfaces()` (`src/features/admin/events-revalidate.ts`). Three reasons:

- The build **already** read the database — `getPublicResults` does it during `next build`
  for the SSG event pages — so builds already required `DATABASE_URL`. Reading the event
  list there adds a query, not a new dependency.
- `dynamicParams` default `true` means an event created after the last deploy is rendered
  on first request and then cached. Nothing about admin-created events needs prerendering
  at deploy time to work.
- Every mutation revalidating is the idiom already in place: `media-actions.ts` and
  `results-actions.ts` flip the landing and event pages without a deploy in exactly this
  shape. `revalidateEventSurfaces` deliberately invalidates *every* event page rather than
  one slug's (`[slug]` is a pattern, not a value) — a lifecycle change moves shared
  surfaces anyway, and an over-broad invalidation costs a re-render while a too-narrow one
  leaves a closed race night still advertising registration.

No page became `force-dynamic`.

**The two new lifecycle states and their public semantics.** The four statuses become six:

- **`draft`** — created but not announced. **404 on every public surface** (detail, heats,
  gallery, results, register), excluded from `generateStaticParams`, absent from the
  landing cards and from the featured-event pick, and 404 there even for a signed-in admin
  — one truth per surface; the admin views a draft in `/admin`. It is the only safe default
  for a freshly created event, so create always lands `draft` and status is not a field on
  the create form.
- **`cancelled`** — the race is off and stays on the record. The public detail page
  **renders with a cancelled banner** rather than disappearing, registration is refused,
  and the roster/results/heats history is kept intact in admin. This is the state the
  08-08 night should have had. `cancelled` from `completed` is refused: rewriting a race
  that ran is not a state change.

Hard delete stays available **only** while the event has zero rows across
`event_registrations`, `event_results`, `event_heats`, `event_media` and `event_email_log`;
otherwise the exit is `cancelled`, and the refusal names the counts.

**The build-time risk, and how it is handled.** The store is deliberately forgiving, like
`media-config.ts` and `results-data.ts`: no `db` or a failed read degrades to `[]` plus a
`console.error`, so the landing, the event pages and their metadata all still build when
the database is missing or briefly unreachable. That forgiveness has one sharp edge — a
build without `DATABASE_URL` produces a site with **zero event pages and no featured
event**, and every individual surface degrades politely enough that the result looks
*intentional* rather than broken. So `warnIfEmpty` in `store.ts` logs one loud warning
whenever the list comes back empty, naming the likely cause. This is not theoretical: this
checkout has no `.env.local`, and the warning duly appears throughout its build output.
Admin mutations are where read failures are loud; the read path is where they are survivable.

**Consequences.**

- The lifecycle is an admin action: no code edit, no deploy, no re-slugging by hand. The
  "adding an event" item in `docs/agents/cross-cutting-checklist.md` is updated to match,
  and its "events are config, not data — do not add an events table" rule is superseded by
  this ADR.
- Every event read is `async`. `isRegistrationOpen(event)` stays synchronous on purpose —
  it is a question about an event you already hold, not a read.
- The selectors share one snapshot per request, and that is load-bearing:
  `getFeaturedEvent`'s open-first preference only means anything if it is looking at the
  same set `getSeriesEvents` is. Do not "optimize" this into per-selector queries.
- Event data is now runtime data, so downstream derivations move under an admin's hands:
  reminder send times follow the event's date + window, and a bib pool edited below a
  currently-held bib must be refused rather than silently accepted (ADR 0003).
- The `event_*` tables still carry **no FK to `events`** — see the schema comments; the
  slug is a stable text join key by design and the delete guard enforces referential
  integrity in the action layer, where it can refuse with counts and offer `cancelled`
  instead.
- ADR 0003's aside that "the pool size lives in the event registry config, not the
  database — events are config" is superseded: `bib_pool` is a column on `events`, editable
  by an admin. The lease model it describes is unchanged.
