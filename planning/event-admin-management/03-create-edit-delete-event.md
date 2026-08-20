# Slice 03 — create, edit, delete an event

Size: M. Dependencies: slices 01 and 02.

## Background

With events as rows (01) and the full lifecycle available (02), this slice adds the three writes. Admin UI is English-only; forms in this panel are **form-post server actions that redirect back with a flash code** (`?ok=`/`?error=`), not client fetch handlers — see `src/features/admin/news-actions.ts` for the closest precedent (create/edit/delete of a trilingual record with slug generation and collision handling).

## Fields and their rules

| Field | Rule |
|---|---|
| Name | Required. Free text; defaults to `"Individual Mile"` in the form. |
| Date | Required, `YYYY-MM-DD`. Creating an event in the past is allowed (back-filling a run night) but warns. |
| Window | Start + end `HH:MM`; required for `individual`, start < end. Defaults offered: `09:15–12:15` (morning) and `17:30–20:30` (evening), the two patterns the series actually runs. |
| Venue / city | Required; prefilled from `EVENT.venue` (`@/lib/marketing/event`). |
| Event type | `individual` default. `team` is selectable but has no registration flow — the form must say so plainly rather than offering a trap. |
| Bib pool | Integer ≥ 1, default 50 (ADR 0003: bibs are leases from `1..bibPool`). |
| Heat interval | Integer ≥ 1 minutes, default 10. |
| Status | Create: always `draft` (not a form field — an unannounced event is the only safe default). Edit: changed via the slice-02 control, not this form. |
| Timetable | Not editable. Generated from the start time by `buildMileTimetable()`; the form previews the generated rows so the admin sees what the public will. |

## Steps

### 1. Slug generation — `src/features/admin/event-slug.ts`

`mile-<YYYY-MM-DD>` for individual events (matching every existing slug), suffixed `-2`, `-3`… on collision. **Immutable after creation**: six tables key off `event_slug` with no FKs (`event_registrations`, `event_results`, `event_heats`, `event_media`, `event_email_log`, plus the ticket signature payload), and the last slug rename in this project was 11 rows moved by hand. The edit form shows the slug read-only with one line saying why. A date moved after creation therefore leaves a slug naming the old date — acceptable and stated.

### 2. Actions — `src/features/admin/event-actions.ts` (alongside `setEventStatus`)

- `createEvent(formData)` — `requireAdmin(locale, "edit")`, zod-validated (`src/features/…/schemas.ts` idiom), generate slug, insert with `status: 'draft'` and `created_by` = actor id, revalidate, redirect to the new event's settings page with `?ok=eventcreated`.
- `updateEvent(formData)` — same gate and validation, slug untouched. Two refusals that must not be silent:
  - **Bib pool below a bib in use**: query the max currently-held bib for the event (`events-data.ts` already knows how to read held bibs — reuse `holdsBib`/roster query rather than writing a new one) and refuse with `?error=bibpool_in_use`.
  - **Window narrowed past existing heats**: heat `scheduledAt` is a stored fact, not derived (`registry.ts:160-163` is explicit that editing config never moves a generated heat). Moving the window does not move heats, so refuse nothing — but warn on save when generated heats now sit outside the window.
- `deleteEvent(formData)` — allowed **only** when the event has zero rows across `event_registrations`, `event_results`, `event_heats`, `event_media`, `event_email_log`. Count all five in one guard; on any non-zero, refuse with `?error=not_empty` and the counts. Requires a typed confirmation of the slug in the form (the `ConfirmSubmit` component exists — use it, plus the typed slug for a destructive irreversible action).

### 3. Pages

- `src/app/[locale]/admin/events/new/page.tsx` — `requireAdmin(locale, "edit")`, the create form, "New event" button on `/admin/events` (index header, `edit`-gated so a viewer is never offered it).
- `src/app/[locale]/admin/events/[slug]/settings/page.tsx` (created in slice 02) — gains the edit form, the read-only slug with its explanation, the generated-timetable preview, and the delete panel at the bottom with its guard state ("3 people have entered — cancel it instead" when non-empty).

Reuse the existing admin form components/field styling from the news editor rather than inventing inputs; ADR 0004 freezes the `.iv-*` layer, so new admin UI uses the admin Tailwind layer.

### 4. Flash codes

`eventcreated`, `eventupdated`, `eventdeleted`, `not_empty`, `bibpool_in_use`, `invalid_window`, plus the date-in-past and heats-outside-window warnings. One code, one sentence, registered in `src/features/admin/flash.ts` (`ERROR_CODES` / the ok table) — never reuse a code whose sentence nearly fits.

### 5. Where a created event shows up

Confirm without new code that a fresh event appears in: admin sidebar (`buildAdminNav` → `getIndividualEvents`), admin events index, the mailings segment picker (`event-mailings/user-segments.ts:219` builds three segments per individual event — a draft **will** appear there; decide and state whether that's wanted, default yes since a draft has no registrations and the segments read empty), and `/admin/users/[id]`'s admin-register dropdown (`getSeriesEvents`, so drafts are excluded — correct).

## Acceptance

- Create a `mile-2026-09-05` event from `/admin/events/new`: lands as draft, appears in admin nav/index, 404s publicly.
- Flip it to `registration_open` (slice 02): the public detail page renders on first request with no deploy (`dynamicParams`), the landing shows it, a real user can register end to end and gets a ticket.
- Edit its window to `17:30–20:30`: public timetable rows change accordingly, detail page facts updated after revalidation.
- Bib pool edit refused while a higher bib is held; refusal names the bib.
- Delete works on an untouched draft; refused with counts once one registration exists; cancel remains available.
- `admin_viewer`/`admin_checkin` see no create/edit/delete controls and cannot invoke the actions directly.
- typecheck/lint/build green.
