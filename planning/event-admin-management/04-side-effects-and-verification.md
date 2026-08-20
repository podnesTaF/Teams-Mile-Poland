# Slice 04 — side-effect audit, end-to-end verification, ADR

Size: M. Dependencies: slice 03.

## Why this is its own slice

An event record used to be immutable between deploys. Now its date, window, pool and status change at runtime, and several subsystems derived numbers from it under the old assumption. This slice hunts those, then drives the whole thing for real — the repo's standing complaint is that things get built and never run against a live DB.

## 1. Mailings

`src/features/event-mailings/schedule.ts` derives reminder send times (`reminder_7d/3d/1d/morning`) from the event's date + window in CEST; `runDueEventMailings` (`dispatch.ts:157`) iterates `getSeriesEvents()` and `event_email_log` makes each `(registration, kind)` idempotent.

- Pulling a date **earlier** can make several reminders due at once on the next cron tick. Decide and implement: either send them (a participant learns the race moved closer — arguably correct) or suppress kinds whose window has already passed. State the choice in the schedule module's docblock.
- Pushing a date **later** cannot un-send a logged reminder, so the participant may get a 7-day reminder 20 days out. The edit form must warn when reminders are already logged for the event (count from `event_email_log`), naming which kinds have gone.
- `cancelled` and `draft` events must be excluded from `runDueEventMailings` — verify `getSeriesEvents`'s new filter (slice 02) actually reaches the dispatcher, since a cancelled night sending "see you tomorrow" is the worst failure mode in this whole plan.
- `media-live.ts:63` and `heat-assignment.ts:112` read the event by slug — confirm both still resolve after the async change and behave for a cancelled event.

## 2. Heats

Heat `scheduledAt` is stored, never derived (`registry.ts:158-163`). Confirm: changing the window or heat interval on an event with generated heats leaves existing heat times alone, and only *newly* generated heats use the new interval / first-heat time (`getFirstHeatTime`). Add the warning from slice 03 if generated heats now fall outside the window. Check the heat capacity guard still reads the live pool (`heat-actions.ts:82,118,253,310`, `flash.ts` capacity copy).

## 3. Broadcast segments

`user-segments.ts:55,219` builds the "Aug events" universe and three segments per individual event from `getIndividualEvents()`. That list is now runtime data, so stored broadcast rows may reference a segment (`registered:<slug>`) for an event that was since deleted. Confirm `parsePerEventSegment` degrades to an empty audience rather than throwing, and that the picker doesn't offer segments for deleted slugs.

## 4. Ticket integrity

`event-registration/ticket.ts:113` reads the event to render the ticket (date/venue). A signed ticket's payload carries the registration id, not the event fields, so a date edit changes what the ticket page *shows* — which is right. Verify a ticket issued before an edit renders the new date, and that a cancelled event's ticket page says so rather than showing a normal ticket.

## 5. Verification run (the point of the slice)

Use the repo's `/verify` skill and the isolated-worktree/HTTP-gate techniques already documented for this project:

1. **Static gate**: `npm run typecheck && npm run lint && npm run build`; record the page count and confirm the created test event's page is either prerendered or on-demand-rendered on first request.
2. **HTTP, all three locales**: landing, `/events/<new-slug>`, `/heats`, register flow, ticket. Grep for content markers, never status codes — streaming makes a redirect/`notFound` look like a 200 (a control route is needed to tell a real 404 from a rendered one).
3. **Admin over HTTP**: drive `/admin/events/new`, the settings tab, status transitions and the delete guard via a temporary signed session row, then remove it.
4. **DB round-trip**: create → edit → open → register a fixture user → check in → cancel → confirm the delete guard refuses → tidy up. Scope every delete to ids created by the run; **this hits the live database — there is no Neon branch for verification** and `.env.local` holds a real Resend key, so no step may send mail.
5. **Revalidation**: prove a status flip is visible publicly with no deploy, in all three locales.

Report PASS/FAIL/SKIPPED per step, with the actual output for anything that fails.

## 6. Write down the decisions

- **ADR 0005 — events are data, not config**: what moved, what stayed in `registry.ts` and why (results sheets, timetable derivation, defaults), slug immutability and the six tables that force it, why public pages stayed SSG + on-demand ISR rather than going dynamic, and the two new lifecycle states with their public semantics. `docs/adr/` holds four ADRs in this format already.
- Update the mile-series phase log with a dated entry (this project logs each phase there).
- Update `docs/agents/cross-cutting-checklist.md` if the "adding an event" checklist item still says to edit the registry.
- Fix any remaining prose that tells the reader events are configuration: `admin/events/page.tsx` empty state (slice 01), `types.ts:11-13`'s Phase-1 note, `event-media.ts:9-10`'s "events live in the config registry, not the DB" comment, `README`/planning docs that repeat it.

## Acceptance

- Every subsystem above audited with a written finding (fixed, or explicitly accepted with a reason).
- A full lifecycle driven live: created → draft → open → registered → checked in → completed, plus a cancel and a delete-guard refusal.
- No mail sent during verification; no fixture rows left behind; no schema change beyond slices 01–03.
- ADR 0005 committed; phase log and stale "events are config" prose updated.
