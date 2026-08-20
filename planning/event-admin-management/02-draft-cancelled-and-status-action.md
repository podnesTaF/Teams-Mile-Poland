# Slice 02 — `draft` + `cancelled` states and the status-change action

Size: M. Dependencies: slice 01.

## Background

`EventStatus` has four values today (`src/lib/events/types.ts:14-18`) and the registry comment records what the missing fifth cost: the cancelled 2026-08-08 night had to be **deleted from the registry outright**, its 11 registrations re-slugged to 08-15 by hand, because `registration_closed` "read as a race still happening with entries shut" (`registry.ts:60-68`). This slice adds the two states the lifecycle actually has and gives the admin the control to move between them.

## The lifecycle

```
draft ──▶ upcoming ──▶ registration_open ──▶ registration_closed ──▶ completed
  └──────────────────── cancelled ◀────────────────────────────────────┘
```

- **draft** — created but not announced. Admin-only: 404 on every public surface, excluded from `generateStaticParams`, absent from landing cards and from the featured-event pick. Present in the admin sidebar and events index, badged as draft.
- **cancelled** — the race is off and stays on the record. Public detail page renders with a cancelled banner, no registration CTA; excluded from the featured pick and from the landing's series cards; its roster/results/heats pages remain intact in admin.

Transitions are guarded, not free-form: forward along the chain, `cancelled` from anywhere except `completed`, and a reopen path (`registration_closed → registration_open`, `cancelled → upcoming`) because a mistake made in one click must be undoable in one click. Refuse anything else with a flash rather than a thrown error.

## Steps

### 1. Types + enum

Extend `EventStatus` (`types.ts:14`) and the `event_status` pg enum (additive migration `0021_*`: `ALTER TYPE … ADD VALUE`). Note that added enum values cannot be dropped — say so in the migration header. The compiler now enumerates the rest of this slice:

- `EVENT_STATUS_DOT` and `STATUS_INK` (`event-status-badge.tsx:14,21`) — draft reads muted/outline (not yet real), cancelled reads as the error tone.
- `EMPTY_ROSTER_COPY` (`admin/events/[slug]/page.tsx:184`).
- `detailState()` (`events/[slug]/page.tsx:30`) + `STATUS_KEY`/`BANNER_TONE` maps beside it — add a `cancelled` display state; `draft` never reaches this function (the page 404s first).
- `displayState()` (`series-list.tsx:19`) — draft and cancelled are filtered out upstream, but keep the map total.

### 2. Public visibility

- `getSeriesEvents` / `getFeaturedEvent` / `getPastEvents` (`store.ts`) exclude `draft` and `cancelled`. `getIndividualEvents` keeps returning everything — it backs admin nav and the broadcast segment universe, which must see drafts.
- Add `isPubliclyVisible(event)` to `store.ts` and use it in `events/[slug]/page.tsx`, `/heats`, `/gallery`, `/results`, and `generateStaticParams` (excludes drafts; keeps cancelled so the page stays reachable). A draft slug 404s publicly even for a signed-in admin — one truth per surface; admin views the draft in admin.
- `EventRegisterContent` (`event-register-content.tsx:30-41`) currently renders a `LifecycleNotice` for any non-open event. Draft must `notFound()`/redirect instead — never advertise an unannounced night. Cancelled keeps the notice, worded as cancelled.
- `registerForEvent` (`event-registration/actions.ts:75`) already refuses anything but `registration_open`; add an explicit test/assertion rather than new logic.

### 3. Trilingual copy

New keys in `messages/{pl,en,ua}.json` under `events.detail.states` and the series list's status labels: `cancelled` (badge + banner sentence — "This race night has been cancelled"). Key parity across all three locales is a hard requirement. `draft` needs **no** public copy — it has no public surface.

### 4. Status-change action

`src/features/admin/event-actions.ts`:

```ts
export async function setEventStatus(formData: FormData)  // slug, status, locale
```

- `requireAdmin(locale, "edit")` — check-in and viewer roles must not move an event's lifecycle.
- Validate the transition against the table above; refuse with `?error=transition`.
- Guard rails worth having: moving to `completed` while registrations are still `registered` (nobody checked in) is legal but worth a flash mentioning the count; `cancelled` from `completed` is refused (rewriting a run race is not a state change).
- Update `status` + `updated_at`, call the slice-01 revalidation helper, redirect back with `?ok=statuschanged`.
- New flash codes in `src/features/admin/flash.ts` (`statuschanged`, `transition`) — one code, one sentence, per that module's contract.

### 5. Where the admin presses it

A **Settings** tab on the per-event shell — add to `EVENT_TABS` (`shell/event-tabs.tsx:24-28`) and create `src/app/[locale]/admin/events/[slug]/settings/page.tsx`. Slice 03 fills the same page with the edit form; this slice puts the status control on it: current state, the legal next states as buttons/select, and a one-line explanation of what each does publicly ("registration_open — the landing's Register button points here").

Additionally: the status badge in the events-index card and the event header stays read-only (it is a statement, not a control) but the card gets a Settings link next to Roster/Heats/Check-in.

## Acceptance

- Flipping `mile-2026-08-29` open → closed from admin changes the public detail page and the landing card **without a deploy** (revalidation working), and back again.
- A `draft` event: 404 on `/events/<slug>` in all three locales, absent from landing and from `generateStaticParams` output, visible in admin sidebar + index + settings.
- A `cancelled` event: detail page renders the cancelled banner in pl/en/ua, no register CTA, `registerForEvent` refuses, roster/results still open in admin.
- An illegal transition (e.g. completed → cancelled) shows the refusal flash and changes nothing.
- `admin_viewer` and `admin_checkin` cannot reach or invoke the status control.
- typecheck/lint/build green; both migrations applied on a Neon branch first.
