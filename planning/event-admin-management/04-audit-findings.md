# Slice 04 — side-effect audit findings

Static audit of slice 04 §1–4, done against the working tree after slice 01 landed
(events are rows, `store.ts` selectors are async, `registry.ts` is a re-export
shim). Slice 02 has **not** landed: `EventStatus` still has four values
(`src/lib/events/types.ts:13-17`), so every "once `draft`/`cancelled` exist"
statement below is a prediction about the filter slice 02 adds, traced through the
call chain that will carry it.

No source file was touched. Line numbers are as of this audit; several files are
being edited concurrently by other sessions.

Verdict tally, 28 findings: **no change needed 14 · fix in slice 03 10 · accepted
risk 4**.

---

## 1. Mailings

### 1.1 A date pulled earlier cannot make several reminders due at once

**What breaks:** nothing — the plan's premise is wrong.
`dueScheduledKind` (`src/features/event-mailings/schedule.ts:67-74`) does not
return the set of kinds whose window has passed. It loops the kinds in
chronological order and *overwrites* `due` each time, so it returns exactly one
kind: the **latest** kind whose `sendAt` has passed. `runDueEventMailings`
(`dispatch.ts:155-163`) sends that one kind and nothing else per event per tick.

Concrete: event on 2026-09-20, admin pulls it to 2026-08-22 on 2026-08-20. Next
tick, `sendAt(reminder_7d)` = Aug 15 and `sendAt(reminder_3d)` = Aug 19 have both
passed, `reminder_1d` has not → `due` is `reminder_3d` alone. One mail. On the
next day `reminder_1d` becomes the latest and sends. `reminder_7d` is never sent
at all — the suppression the plan asks for is already the implemented behaviour,
for the skipped kinds, and there is no burst to prevent.

**Decision (the plan asked for one): send the one kind that is due; do not add
suppression.** Docblock line for `schedule.ts`:

> Only the *latest* passed kind is ever due, so pulling an event's date closer
> cannot produce a burst — it silently skips the kinds the new date has already
> gone past, and sends the closest one on the next tick. That send is kept
> deliberately: it is the moment a reminder matters most, and the mail carries the
> event's live date and window, so the participant reads the true new date even
> when the kind's own "3 days to go" wording is off by however far the date moved.

**Verdict: no change needed** (logic already matches the decision). Slice 03 adds
the docblock sentence only.

### 1.2 The mail body always carries the *current* date

**What breaks:** nothing, and this is what makes 1.1 safe.
`whenWhereFor` (`dispatch.ts:66-80`) formats the date/time from the `EventSummary`
handed in at send time, and `eventFooterMeta`
(`src/emails/components.tsx:20-24`) builds "venue · shortDate" the same way. No
send path stores or replays event facts.

**Verdict: no change needed.**

### 1.3 The day-count wording is hard-coded per kind

`reminder_7d`'s copy says "7 days to go" / "Za 7 dni" / "За 7 днів" in all three
locales (`copy.ts:82-123`, and the same shape for 3d/1d). A kind sent after a date
move is off by exactly the size of the move. The when/where block beside it is
correct (1.2), so the mail is internally inconsistent but not misleading about
when to show up.

**Verdict: accepted risk.** Rewriting four kinds × three locales into
relative-day templating is a bigger change than the failure justifies, and the
authoritative fact in the mail is already right.

### 1.4 A date pushed later permanently consumes the reminders already logged

**What breaks:** `alreadySent` (`dispatch.ts:27-43`) skips any registration with a
`sent` row for that kind, and the unique index
`event_email_log_registration_kind_unique`
(`src/db/schema/event-email-log.ts:45`) is on `(registration, kind)` with no
notion of a send *window*. So a race moved from Aug 22 to Sep 26 the day before it
was due leaves `reminder_7d`, `reminder_3d` and `reminder_1d` all logged: the
chain will never fire them again, and the participant hears nothing for a month
until `morning` on Sep 26. The admin cannot force it either — the mailings page's
per-kind **Send now** button goes through `sendEventKind`, which applies the same
`alreadySent` skip.

Re-arming by deleting the logged rows was considered and is **rejected**: the log
is the audit record of what actually left the building, and a date flip-flopped
twice would then mail the same person the same reminder twice.

**Verdict: fix in slice 03 — a warning on the edit form, not a logic change.**
What it must count, exactly:

- Source: `event_email_log` joined to `event_registrations` on
  `event_registration_id`, filtered `event_registrations.event_slug = <slug>` and
  `event_email_log.status = 'sent'`, grouped by `event_email_log.kind`.
- Restricted to the four scheduled kinds (`reminder_7d`, `reminder_3d`,
  `reminder_1d`, `morning`) — `confirmation`, `media_live` and `heat_assignment`
  are not date-derived and must not appear in this warning.
- **Reuse `sentCountByEventAndKind` (`event-mailings/data.ts:43-58`)**, which
  already computes precisely this map keyed `${eventSlug}:${kind}`; give it an
  optional slug filter rather than writing a second query.
- Wording must name the kinds and counts *and* the way out: the reminder chain
  cannot re-fire a logged kind, so the operator's tool is a user broadcast to the
  `registered:<slug>` segment (which has no per-kind idempotency —
  `user-broadcast.ts:22-34` dedupes per `(user, broadcast)`, so a new broadcast
  reaches everyone).

### 1.5 `cancelled` / `draft` really are excluded from the cron once `getSeriesEvents` filters them

**Chain verified end to end:** `src/app/api/cron/mailings/route.ts:24` →
`runDueEventMailings` (`dispatch.ts:155`) → `for (const event of await
getSeriesEvents())` (`dispatch.ts:157`) → imported from `@/lib/events/registry`
(`dispatch.ts:9`) → re-exported from `store.ts` (`registry.ts:41-55`) →
`store.ts:174-179`. There is no second event list and no per-slug read in the
dispatcher, so a filter added inside `getSeriesEvents` reaches the cron with
nothing else to change. The same call also feeds `getEventMailingsOverview`
(`data.ts:69`), so a cancelled night also drops off the admin mailings page —
which is what removes its **Send now** buttons from the UI.

**The filter must live in `getSeriesEvents`, not in the dispatcher.** Its other
five consumers all want the same exclusion: the landing series cards
(`components/landing/event-series.tsx:15`), the profile's "other events you could
enter" (`app/[locale]/profile/page.tsx:167`), the admin-register dropdown
(`app/[locale]/admin/users/[id]/page.tsx:73`), the admin Aug-slug universe
(`features/admin/users-data.ts:21`) and the mailings overview.

**Verdict: no change needed** beyond slice 02's filter — but treat this as the
acceptance test the whole plan hangs on.

### 1.6 `sendEventKindNowAction` has no status guard — a hand-posted form can mail a cancelled night

**What breaks:** admin cancels `mile-2026-08-29`; the row vanishes from the
mailings page (1.5) but the server action does not. `sendEventKindNowAction`
(`event-mailings/actions.ts:33-52`) validates only `requireAdmin(locale, "edit")`,
that the slug resolves, and that `eventType === "individual"` (line 41). Status is
never checked. A stale open tab's form post, or a re-submitted browser
back-and-resubmit, sends "see you tomorrow" for a cancelled race — the exact
failure the plan calls the worst in the whole feature, reached without the cron.

**Verdict: fix in slice 03.** Add to the line-41 guard: refuse unless
`event.status` is one of `upcoming`, `registration_open`, `registration_closed`.
`back(locale, "This event is cancelled — nothing was sent.")` follows the module's
existing `back(locale, msg)` idiom, no new flash code needed.

### 1.7 `publishHeatsAndNotify` has no status guard either — the same hole, worse copy

**What breaks:** `publishHeatsAndNotify`
(`event-mailings/heat-assignment.ts:111-115`) guards `!event || event.eventType
!== "individual"` and nothing else. The Heats tab stays fully functional for a
cancelled event (`admin/events/[slug]/heats/page.tsx:66-67` also only checks
`eventType`), so an admin who cancels the night and then presses **(Re)publish**
on the heat card — or whose colleague does, not knowing — mails every seeded
runner "Your heat is 4 at 18:40" for a race that is off. Worse than 1.6, because
`heat_assignment` is deliberately *not* gated by the email log
(`heat-assignment.ts:105-109`), so it re-sends on every press.

**Verdict: fix in slice 03.** Refuse in `publishHeatsAndNotify` when
`event.status` is `cancelled` or `draft` — it already has the right exception type
(`HeatPublishNotEligibleError`) and `publishHeats`
(`heat-actions.ts:210-215`) already maps it to `error=input`; give it its own
flash code so the refusal says why.

### 1.8 `media-live.ts` is already safe for a cancelled event

`sendMediaLiveMailing` (`media-live.ts:62-73`) requires `status === "completed"`
*and* a published `event_media` row, so `cancelled` and `draft` both throw
`MediaLiveNotEligibleError` the moment the status set grows — no edit needed. The
`getEventBySlug` read is properly awaited at line 63.

**Verdict: no change needed.** (Cross-check: slice 02 refuses `completed →
cancelled`, so there is no path where a gallery-published event becomes
cancelled.)

### 1.9 `heat-assignment.ts` resolves correctly after the async change

`await getEventBySlug(eventSlug)` at `heat-assignment.ts:112`, result used for
`event.name` and `eventFooterMeta(event)` only. Behaviourally identical to the
sync version. (Its *status* behaviour is 1.7.)

**Verdict: no change needed.**

### 1.10 `schedule.ts` hard-codes the CEST offset — which was safe only while events were config

**What breaks:** `CEST_OFFSET_HOURS = 2` (`schedule.ts:36`), commented "Warsaw
summer offset (the series runs in August)". That was a true statement about a
literal array an engineer edited. An admin can now create `mile-2026-11-14` from a
form: every `sendAt`, `eventStart` and `eventEnd` for it is computed an hour off,
including the `now > eventEnd` cutoff at `schedule.ts:68`. The repo already has
the correct primitive one directory away — `heat-time.ts:47-55` resolves Warsaw's
offset *per instant* precisely so a stored heat time cannot shift, and says so in
its docblock.

**Verdict: accepted risk**, with a stated reason rather than silence: the error is
bounded at one hour on a 09:00 send time, so no reminder crosses a day boundary,
and the CET months are outside the series as it is actually run. The cheap fix if
slice 03 has room: reuse the offset resolution from `heat-time.ts` instead of the
constant, and delete the "the series runs in August" comment — it is no longer a
fact anyone controls.

### 1.11 Back-filling a past event is mail-safe by construction

Slice 03 allows creating an event in the past. `dueScheduledKind` returns `null`
whenever `now > eventEnd(event)` (`schedule.ts:68`), so a back-filled night is
never due for anything, whatever its status. Doubly safe: it is created as
`draft`, which slice 02 excludes from `getSeriesEvents`.

**Verdict: no change needed** — worth stating in the create form's
date-in-the-past warning so the admin knows the warning is about the slug and the
public page, not about mail.

### 1.12 The confirm CTA window is also date-derived — the plan does not mention it

**What breaks:** `confirmationOpensAt` (`event-registration/confirmation.ts:28-30`)
*is* `sendAt("reminder_7d", event)`. So a date edit moves the "are you coming?"
CTA on both the ticket page (`app/[locale]/tickets/[registrationId]/page.tsx:60-66`)
and the profile card (`app/[locale]/profile/page.tsx:332`). Push the date out and
a runner who saw the CTA yesterday finds it gone; pull it in and it appears at
once. Nothing is lost — `confirmRegistration` deliberately accepts a late confirm
(`confirmation.ts:82-84`) and the window is documented as display-only.

Separately: `isConfirmationOpen` (`confirmation.ts:36-46`) excludes `completed`
but will not exclude `cancelled`. So a cancelled night's ticket page keeps asking
"are you coming?".

**Verdict: fix in slice 03** for the cancelled case — add
`if (event.status === "cancelled") return false;` beside the `completed` line.
**No change needed** for the CTA moving with the date; mention it in the edit
form's warning so the admin is not surprised by a support question.

---

## 2. Heats

### 2.1 Heat `scheduledAt` is a stored fact — verified, and the plan's citation is dead

**Verified against the code, not the prose.** `createHeats`
(`features/admin/heats-data.ts:205-220`) computes `scheduledAt` as
`firstStart + i * intervalMinutes` where **both come from the submitted form**, not
from the event: `generateHeats` reads `firstStart` from the `datetime-local` field
and `intervalMinutes` from the number field (`heat-actions.ts:81-84`). The column
is a plain `timestamptz` and the only other writer is `updateHeatRow`
(`heats-data.ts:230-243`), driven by the admin editing one card. Nothing anywhere
recomputes a heat time from an event. So changing an event's window, date or
`heat_interval_minutes` provably cannot move an existing heat row.

Where the event *does* reach heat generation is the **prefill only**:
`admin/events/[slug]/heats/page.tsx:87-102` resolves `getHeatIntervalMinutes` and
`getFirstHeatTime` and builds `firstStartValue`. Confirmed
`getHeatIntervalMinutes`'s own docblock already states the contract
(`store.ts:214-218`), as does the schema comment (`db/schema/events.ts:59`).

**Verdict: no change needed.** See "Corrections" — the plan cites
`registry.ts:158-163`, which no longer exists.

### 2.2 After a date move, "Add heats" prefills onto the *old* date

**What breaks:** the prefill has two branches
(`admin/events/[slug]/heats/page.tsx:97-102`). With no heats yet it is
`${event.date}T${firstHeat}` — live, correct. With heats already on the card it is
one interval past the latest existing heat, i.e. anchored on the stale date. So:
admin moves 08-22 → 08-29, opens the Heats tab, presses **Add heats**, and gets
heat 10 scheduled on 08-22. The page's copy even reassures them
("existing heats and their times are left alone", line 141), which is true and
beside the point.

**Verdict: fix in slice 03** — the out-of-window warning (2.3) must render on the
**Heats tab**, above the generate form, not only as a post-save flash on the
settings page. An admin who moves a date and then generates heats never sees a
save flash from the previous page.

### 2.3 Precisely when "generated heats now sit outside the window" is true

Definition to implement, so the warning is not a judgement call:

> A heat is outside the window when, converted to Warsaw wall-clock via
> `instantToWarsawLocal(heat.scheduledAt)` (`lib/events/heat-time.ts:77`), either
> its **date part differs from `event.date`**, or its **time part falls outside
> `[firstHeatTime(event.timeRange.start), event.timeRange.end]`**.

Three deliberate choices in that predicate:

- The **date mismatch is the dominant case** and the one that actually matters: a
  date move strands the entire card on a day nobody will be at the stadium. A
  window narrowing typically strands one or two heats at the tail.
- The lower bound is `firstHeatTime(start)` = `start + 60` minutes
  (`lib/events/timetables/index.ts:18-27`), **not** `start`: the first hour of
  every event's window is check-in and briefing, and `firstHeatTime` is already
  what the generator prefills from, so the warning and the prefill agree.
- The upper bound is the window's `end`, not the timetable's nominal
  `start + 150` racing block, so a card that deliberately runs into the cooldown
  slot does not trip a false warning.
- Events with no `timeRange` (the legacy team event) are out of scope — they have
  no heats and `notFound()` on the Heats tab anyway.

**Verdict: fix in slice 03.** Implement as a pure function beside its twin:
`heatsOutsideWindow(heats: HeatWithFill[], event: EventSummary): number[]` in
`heats-data.ts`, mirroring `outOfOrderHeats` (`heats-data.ts:166-174`) exactly —
returns heat numbers, warns rather than blocks, rendered through `AdminNotice` the
way `heats/page.tsx:116-121` already renders the out-of-order warning. Refuse
nothing: an admin mid-reschedule may legitimately move the date first and the
heats second.

### 2.4 The capacity guard reads the live pool — verified at all four sites plus the copy

Every bound is a fresh `await getBibPool(slug)` inside the action, never a
captured value: `heat-actions.ts:82` (generate), `:118` (edit one heat), `:253`
(seed final), `:310` (manual bib lease), plus `checkin-actions.ts:204` (the desk)
and `events-data.ts:301` (`suggestNextBib`). The refusal *copy* is bounded by the
pool the page resolved and passed in — `flash.ts:152-157` reads
`ctx.bibPool`, and all five admin event pages pass it
(`heats/page.tsx:113`, `page.tsx:124`, `results/page.tsx:74`, `media/page.tsx:57`,
`checkin/page.tsx:110`), so a pool edited between two presses is reflected in both
the refusal and its sentence.

**Verdict: no change needed.** The `FlashContext` seam from slice 01 is doing
exactly the job it was added for.

### 2.5 Shrinking the pool leaves existing heat *capacities* above it

**What breaks:** slice 03 refuses a pool edit below the highest **held bib**. It
does not look at heat capacity, which is a separate stored number bounded only at
write time (2.4). Pool 50 → 20 with six heats of capacity 12 leaves a card that
claims 72 lanes against 20 chips; the Heats tab's "Capacity" stat
(`heats/page.tsx:92, 132`) then reads 72 beside "Bib pool 20".

Nobody can be handed an unchippable bib — `checkin-actions.ts:204` and
`heat-actions.ts:310` both bound against the live pool — so this is a
consistency/planning problem, not a data-integrity one.

**Verdict: fix in slice 03**, as a warning on save (not a refusal): "6 heats total
72 lanes against a 20-bib pool". Refusing would force the admin to shrink every
heat before shrinking the pool, in an order the UI does not support.

---

## 3. Broadcast segments

### 3.1 An unknown slug resolves to **every consenting user**, not an empty audience — the plan is wrong, and this is the sharpest finding in the audit

**What breaks:** `whereForSegment`'s default branch
(`event-mailings/user-segments.ts:139-158`) calls `parsePerEventSegment`, and on
`null`:

```ts
const parsed = await parsePerEventSegment(segment);
// parseUserSegment already validated; this is a type narrowing guard.
if (!parsed) return notOptedOut;
```

`notOptedOut` is `eq(users.marketingOptOut, false)` — the predicate for
**segment `all`**. So an unresolvable `registered:<slug>` does not degrade to
nobody; it degrades to the entire consenting mailing list. And
`parsePerEventSegment` returns `null` for exactly the case the plan is worried
about: `user-segments.ts:64` accepts the slug only if it is in
`await augEventSlugs()`, i.e. currently in the `events` table.

The comment on line 141 is the whole bug in one sentence. It was true while
events were compile-time config: nothing could invalidate a slug between the
`parseUserSegment` call and the `resolveUserSegment` call, because the event list
changed only on deploy. Events are runtime data now.

**Live path, no tampering required:** `resendUserBroadcastAction`
(`user-broadcast-actions.ts:42-59`) → `resendUserBroadcast`
(`user-broadcast.ts:130-143`) reads the stored row and does
`segment: row.segment as UserSegment` — a bare cast, no re-validation — into
`deliver` → `resolveUserSegment` → `whereForSegment`. So: admin deletes an empty
draft event, later presses **Re-send** on the broadcast that had been written for
that night's 12 registrants, and the mail goes to every consenting user in the
database. Note that slice 03's delete guard counts five tables and
`user_broadcasts` is not one of them, so the stranded segment string is reachable
by design, not by accident.

**Verdict: fix in slice 03. Two changes, both cheap, and take both.**

1. `whereForSegment`'s fallback must be an empty audience:
   `return and(notOptedOut, sql\`false\`)!`. Docblock line: *"An unresolvable
   per-event segment means the event is gone, and the audience of a gone event is
   nobody — never `all`. Events are rows now, so a stored segment can outlive its
   slug."*
2. `resendUserBroadcast` must re-validate through `parseUserSegment` and return
   `null` (→ "Broadcast not found." / a truer sentence) rather than casting. The
   cast is the reason a stored string reaches the resolver unchecked.

### 3.2 The picker cannot offer a deleted slug

`describeUserSegments` (`user-segments.ts:212-236`) builds the per-event options by
`flatMap` over `await getIndividualEvents()`, so the three options per event exist
only while the row does. There is no stored option list. `parseUserSegment`
(`:75-87`) then re-checks the submitted value against the same live list, so a
stale open tab's post is refused with "Unknown audience segment."
(`user-broadcast-actions.ts:31-33`).

**Verdict: no change needed.**

### 3.3 `parseUserSegment` became async — every caller checked

Exactly one caller: `user-broadcast-actions.ts:26`, awaited, with a comment
already recording why the `await` is load-bearing (an un-awaited Promise is
truthy, so the `!segment` tamper gate would never fire). `whereForSegment`'s
internal use is awaited at `:140`; `augEventSlugs` is awaited at `:64,136,138`.
`describeUserSegments` is awaited by its single consumer
(`app/[locale]/admin/mailings/page.tsx:79`).

**Verdict: no change needed** — slice 01 handled this correctly.

### 3.4 An empty event list turns `not_registered_aug` into "everyone, including the registered"

**What breaks:** the store is deliberately forgiving — a missing `db` or a failed
query returns `[]` (`store.ts:103-115`). Then `augEventSlugs()` is `[]`, and
`registrationUserIds([])` builds a subquery whose `WHERE` is `inArray(eventSlug,
[])` → `sql\`false\`` (verified in `drizzle-orm@0.45.2`,
`sql/expressions/conditions.cjs:111-119`). So the subquery returns no rows and
`notInArray(users.id, <empty subquery>)` is true for everyone:
`not_registered_aug` (`user-segments.ts:138`) becomes the whole list, and
`registered_any_aug` (`:136`) becomes nobody. An admin pressing Send during a
transient DB hiccup mails a "you haven't signed up yet" campaign to people who
have.

The repo already solves this one file away: `users-data.ts:129-131` guards the
same shape with `augSlugs.length > 0 ? inArray(...) : sql\`false\``.

**Verdict: fix in slice 03** — cheap, precedented, and the mitigation (the picker
shows a wrong count first, `describeUserSegments:234-236`) is not something an
admin is obliged to notice.

### 3.5 Keep `cancelled` events in `getIndividualEvents` — this is a decision, not an oversight

Slice 02 has `getIndividualEvents` return everything. That is right, and for a
reason worth writing down: **the "your race night is off" broadcast needs an
audience, and its audience is `registered:<slug>` for the cancelled night.**
Filtering cancelled out of the segment universe would remove the only tool the
admin has for telling those runners anything, at the one moment they must be told.
Same reasoning keeps drafts in (slice 03 already decided this): a draft has no
registrations, so its three segments read zero and cost nothing.

**Verdict: no change needed** — state the reason in `getIndividualEvents`'s
docblock, which currently justifies the inclusion of *completed* events only.

### 3.6 Once `getSeriesEvents` excludes cancelled, the admin user list's "Aug registrations" quietly changes meaning

`users-data.ts:20-22` has its **own** `augEventSlugs`, built from
`getSeriesEvents()` rather than `getIndividualEvents()` — so the admin user list's
registered/not-registered filter and per-user Aug count already exclude
*completed* nights, and will start excluding cancelled ones too. A user whose only
entry was for a cancelled night will read as "not registered".

**Verdict: no change needed.** The column already means "registered for an
upcoming Aug night", and a cancelled night is not upcoming; adding it to the
exclusion is the consistent reading. Worth one line in the ADR because the two
`augEventSlugs` functions look like duplicates and are deliberately different
universes.

---

## 4. Ticket integrity

### 4.1 A date edit changes what the ticket shows, and nothing else — verified

The signature covers the registration id and a purpose string and nothing else:
`sign(EVENT_PURPOSE, registrationId)` = `HMAC(secret, "event-ticket:<id>")`
(`features/ticket/sign.ts:19-21, 52-54`). The rendered facts are built fresh on
every request: the page reads `await getEventBySlug(loaded.registration.eventSlug)`
(`app/[locale]/tickets/[registrationId]/page.tsx:51`) and passes it to
`buildEventTicketView` (`event-registration/ticket.ts:80-98`), which derives
`eventName`, `eventDateLabel` (`event.shortDate`), `eventTime` and `eventVenue`
from the live row. The page is dynamic (it reads `searchParams` for the signature),
so there is no cache entry to invalidate — a ticket issued in July renders
September's date the moment the row changes, with no revalidation and no re-issue.

**Verdict: no change needed.** This is the behaviour the plan wants, and it is the
payoff for slug immutability: the QR baked into already-sent mail keeps working
across an edit precisely because it carries no event facts.

### 4.2 The `event === undefined` fallback is graceful and effectively unreachable

`buildEventTicketView` falls back to `"Individual Mile"` and prints the slug where
the date would go (`ticket.ts:92-95`). Slice 03's delete guard refuses deletion
while any `event_registrations` row exists, so a ticket whose event is gone cannot
be created through the UI.

**Verdict: no change needed** — keep the fallback as the belt-and-braces it is.

### 4.3 A cancelled event's ticket page currently renders a completely normal ticket

**What breaks:** nothing in the page consults `event.status` except the heat
display (`:77`, which only checks `completed`). So after a cancellation the runner
opens the link in their inbox and gets: the ticket card, the QR under the words
**"Scan at check-in"** (`:139-143`), "Bib — Assigned at check-in" (`:126`), and —
because `isConfirmationOpen` does not know about `cancelled` (1.12) — a live
**"are you coming?"** form (`:169-179`). Every one of those is a promise the
organiser is no longer keeping, on the surface the participant is most likely to
look at after hearing a rumour that the race is off.

**Decision: the ticket page must say the race is cancelled instead of rendering a
scannable ticket.** Concretely, when `event.status === "cancelled"`:

- replace the QR block with the cancelled notice — the QR is the *check-in
  instrument*, and there is no check-in;
- suppress the confirm form (1.12's fix does this in one line, in the right
  layer);
- keep the card, the runner's details and the `#XXXXXXXX` code visible: the
  registration is history that is kept, per the plan's cancellation semantics, and
  the runner may need to quote it;
- do **not** `notFound()`. A dead link where a ticket used to be is the worst of
  the options — it looks like the site lost their entry.

Docblock/comment line: *"A cancelled night has no check-in, so the ticket page
shows the cancellation rather than a scannable QR — the registration is kept on
the record, but nothing on this page may imply the race is still on."*

**Copy source: reuse the `events.detail.states.cancelled` keys slice 02 adds in
pl/en/ua.** No new i18n keys, and the ticket page then says the same sentence as
the public event page. (The page's other literals are deliberately English-only
per PRD #26 — do not extend that precedent to the one sentence that tells someone
their race is off.)

**Verdict: fix in slice 03.**

---

## 5. Found outside the plan's four areas

### 5.1 Minimum participant age is validated at entry only, against the event's date

`registerForEvent` and the guest path check `meetsMinParticipantAge(dob,
parseDateOnly(event.date))` (`event-registration/actions.ts:67, 146`;
`MIN_PARTICIPANT_AGE = 16`, `lib/age.ts:4`). Nothing re-checks after the fact, so
moving a date **earlier** across a registrant's 16th birthday leaves an
under-age entry on the roster. Moving it later can only help.

**Verdict: accepted risk.** The window is a birthday-sized sliver of a
date-move-sized sliver, the rule is an organiser policy rather than a legal gate
in this codebase, and re-validating registrations on edit would mean deciding
what to *do* with the offending row — a much larger conversation than the risk
justifies. Worth one clause in the edit form's date warning.

Related and harmless: `ageCategoryForDob(dob, eventDate)`
(`events-data.ts:314-326`, via `roster-view.ts:64`) is recomputed live from the
event date on every roster render and XLSX export, and is explicitly labelled
"for admin reference (not official seeding)" — so a date edit reshuffles a display
column and nothing that has been promised to anyone.

### 5.2 The leaderboard's "best event" tie-break orders by event date

`lib/events/leaderboard.ts:148-166, 180` compares `event.date` strings to pick and
order a runner's best result. Editing a **completed** event's date therefore
reorders leaderboard tie-breaks. Slice 02/03 allow editing a completed event's
date (only the status transition to `cancelled` is refused from `completed`).

**Verdict: accepted risk** — you would only edit a run race's date to correct a
typo, and the correction is exactly what should move the ordering.

---

## Corrections to the plan

1. **§1's premise about a burst is wrong.** `dueScheduledKind`
   (`schedule.ts:67-74`) returns **one** kind — the latest whose `sendAt` has
   passed — not the set of passed kinds. Pulling a date earlier cannot make
   "several reminders due at once on the next cron tick"; it silently *skips* the
   kinds the new date has gone past. The suppression §1 asks us to choose is
   already the implemented behaviour; what needed deciding was whether to keep it
   (yes — 1.1).
2. **§3's premise about the fallback is wrong, and dangerously so.**
   `parsePerEventSegment` failing does not "degrade to an empty audience" — the
   caller `whereForSegment` returns `notOptedOut` (`user-segments.ts:142`), which
   is the predicate for segment `all`, i.e. **every consenting user**. See 3.1.
3. **§4 asks us to verify "a cancelled event's ticket page says so rather than
   showing a normal ticket".** It does not, today, in any respect — the QR, the
   "Scan at check-in" caption and the live confirm form all render unchanged
   (4.3). This is a fix, not a verification.
4. **Migration numbering, again.** The `events` table landed as **0021**
   (`src/db/migrations/0021_rich_toxin.sql`, journal `when` 1787238106710), not
   0020 as both the README's risks section and slice 01 §2 say — 0020 was already
   taken. Consequently **slice 02 §1 is wrong twice**: its "additive migration
   `0021_*`: `ALTER TYPE … ADD VALUE`" both collides with an existing number and
   is unnecessary. `events.status` is plain `text` with `$type<EventStatus>()`
   (`db/schema/events.ts:42`), chosen precisely because `ALTER TYPE` cannot run in
   a transaction and stranded migration 0012 on the live DB. Adding `draft` and
   `cancelled` needs **no migration at all** — the 0021 header says so
   explicitly, and slice 02 should say the same.
5. **Dead line citations in slices 03 and 04.** `registry.ts` is 55 lines now.
   `registry.ts:158-163` / `:160-163` ("heat `scheduledAt` is stored, never
   derived"), `:60-68` (the 08-08 cancellation), `:80-87` (`getFeaturedEvent`'s
   open-first preference) and `types.ts:11-13`'s Phase-1 note all moved. The
   surviving homes: the stored-fact contract is `store.ts:214-218` and
   `db/schema/events.ts:59`; the 08-08 history is `registry.ts:20-26` and the
   0021 migration header; `getFeaturedEvent` is `store.ts:117-132`.
6. **Slice 01 §Background and §Acceptance say "four" registry entries / "four
   seeded rows"; there are five** (`warsaw-2026`, `mile-2026-08-01`,
   `mile-2026-08-15`, `mile-2026-08-22`, `mile-2026-08-29`) — as the 0021 seed
   block itself states. Same error the README's own text avoids by listing all
   five.
7. **§2's `flash.ts` capacity-copy check passes, but note where the pool comes
   from**: not `flash.ts` (which stays synchronous by design) but each page's
   `context={{ slug, bibPool }}`. Any *new* admin page that renders
   `<AdminFlash>` for a pool-bounded refusal must pass it or the sentence
   silently drops the number (`flash.ts:63-74, 152-157`).
8. **Two files slice 04 plans to create already exist in the working tree**
   (untracked, from other sessions): `docs/adr/0005-events-are-data-not-config.md`
   and `src/features/admin/event-slug.ts` (slice 03 §1). Neither was audited here.
   `src/features/admin/events-revalidate.ts` exists as slice 01 §5 specified; note
   it deliberately does **not** cover `/gallery` or `/results`.
