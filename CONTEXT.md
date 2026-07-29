# Teams Mile

The event site for the Teams Mile running events: one completed legacy team race
(`warsaw-2026`) and the Aug-2026 individual mile series, all at a single Warsaw stadium.

## Language

### Events

**Event**:
A single mile race in the series. Config-only — defined in the event registry
(`src/lib/events/registry.ts`), never a DB row.
_Avoid_: race (ambiguous), meet

**Event series**:
The set of individual mile events in Aug-2026, sharing one venue. The `individual`
entries in the registry.

**Event lifecycle status**:
Where an event sits in its timeline: `upcoming → registration_open →
registration_closed → completed`. A property of the event config — never of a
registration.
_Avoid_: event state, stage

**Event type**:
`individual` (Aug-2026 mile series, per-person registration) or `team` (legacy
warsaw-2026 stack). Selects which registration flow a page links to.

### Registration

**Registration**:
A runner's confirmed entry into one event — the `event_registrations` row, unique
per `(event_slug, user_id)`. The noun always means the row; for the act, say
"registering". Always backed by a **verified** email — no row is created before
email confirmation.
_Avoid_: entry, signup (as a noun), booking

**Runner**:
A person who runs an event, in either format — the general word for the human
participant. In the individual series a runner is backed by a `users` account; there
is no separate per-person row. Reused deliberately across both formats.
_Note_: Distinct from the legacy `runners` **table**, which persists team-format
participants. The concept ≠ the frozen table — never wire individual-event code to
`runners`.
_Avoid_: participant, athlete, registrant (for the person)

**Free registration**:
A registration created at no cost with no capacity limit — the only kind that exists
today. Created by `createFreeRegistration`; guarded solely by the unique
`(event_slug, user_id)` index.

**Pending registration**:
An in-flight checkout payload (`pending_registrations` row) held during Stripe
checkout — **not yet** a registration. Becomes one only on successful payment. The
seam for the planned paid/capped flow; unused by today's free path.
_Avoid_: draft registration, cart

**Guest registration**:
Passwordless, email-verification-gated registration by a logged-out visitor. The
guest form creates an **unverified** `users` account (no registration yet) and sends
a verification email; only after the visitor confirms via the link is the
registration created and the ticket sent. Existing verified email → sign-in; existing
unverified email → idempotent resend.

**Unverified account**:
A `users` row with `emailVerified: false` — a lead, not a participant. No
registration exists for it; it becomes a participant only after email confirmation.
_Avoid_: pending user, guest (guest = the act/flow, not the account)

**Participation status**:
Where a runner sits within one event: `registered → confirmed → checked_in →
no_show` (the `participation_status` enum). A property of the registration —
distinct from event lifecycle status. There is **no** proactive-cancellation state;
the only non-attendance outcome is `no_show`. (`cancelled` remains physically
present in the enum and is deprecated.)
_Avoid_: registration status, attendance, cancelled (dropped — see No-show)

**Ticket**:
The user-facing confirmation of a registration — the ticket page (`ticketUrl`) and
its email. Not a separate entity; a view of the registration row.

### Outreach

**User broadcast**:
An admin-composed one-off email sent to an audience segment of `users`. Lives in
the event-mailings world; deduped per (user, broadcast). Distinct from the frozen
legacy team broadcast (which targets the `runners` table) and from automated
lifecycle emails.
_Avoid_: newsletter (no subscription list exists), campaign

**Audience segment**:
A named, queryable slice of `users` a broadcast can target (e.g. first-event
attended, first-event no-show, not registered for any Aug event). Always excludes
opted-out users.

**Marketing opt-out**:
A user-level flag set via the unsubscribe link in broadcast emails. Blocks all
future broadcasts; never blocks transactional email (tickets, verification).

### Confirmation, heats and race day

**Confirmation**:
The runner's **remote, pre-race** act of declaring they are coming, moving the
registration `registered → confirmed` and stamping `confirmedAt`. Reachable without
a password (from the profile, or from the signed ticket page). A soft signal, not a
gate: someone who never confirmed but turns up is still checked in and still raced.
_Avoid_: check-in (that is the on-site step), activation, "marking active"

**Check-in**:
The admin's **on-site** verification that a runner has physically arrived, normally
by scanning their ticket QR: participation status → `checked_in`, leasing a bib.
_Avoid_: confirmation (that is the remote step), arrival, attendance

**Heat**:
One running of the mile within an event — a capped group of registrations with a
scheduled start time (`event_heats`). A registration belongs to at most one heat.
Heat state is derived from two timestamps, not stored as an enum:
`finishedAt ? finished : publishedAt ? published : draft`.
_Avoid_: race (that is the event), round, wave, group

**Publish (heats)**:
The admin act of releasing an event's whole heat card and emailing every seeded
runner their heat and approximate start time. Per-event and re-pressable: a second
press notifies only runners whose heat or time actually changed, plus anyone never
notified.

**Bib**:
A number **leased** from the event's fixed physical pool at check-in and returned
when its heat is marked finished — not an identity (see
`docs/adr/0003-bibs-are-recycled-leases.md`). Held by at most one runner at a time
(partial unique index on un-returned bibs), but reused across heats within one
event. A retained `bib` with `bibReturnedAt` set stays historically accurate.
Consequence: `bib` alone never identifies a result within an event — `(heat, bib)`
does.
_Avoid_: number, tag, chip (the chip and the bib are the same object)

**Bib pool**:
The fixed set of physical bibs the timing system supplies at a venue (default 50).
Lives in the event registry as `bibPool`, **not** in the database. Heat capacity is
hard-capped at it; an empty pool never blocks check-in (the runner is marked present
with a bib pending).

**Start list**:
The public, per-heat listing of an event's **published** heats — name, club, heat and
start time. Carries no bibs.
_Avoid_: startlist, entry list, roster (roster is the admin-side view)

**No-show**:
A registered runner who never checked in; participation status `no_show`, set
passively at check-in. This is the only "didn't participate" outcome — there is no
separate proactive cancellation.

### Legacy (frozen — warsaw-2026 team format)

**Legacy participation**:
A persisted link recording that a user took part in the frozen warsaw-2026 team
event — written once by the first-event import, never by live flows. Carries an
`attended` fact. Distinct from **Registration**, which stays individual-series-only
and verified-email-backed; the two are unioned into a user's event history.
_Avoid_: legacy registration, historical registration

**Attended (warsaw-2026)**:
An imported person counts as attended iff they appear in the official results file
(`src/lib/events/results/warsaw-2026.ts`, name-matched) **or** their legacy runner
row was checked in. Everyone else imported is a first-event no-show.

**First-event import**:
The one-time script that reads the frozen `runners` table (read-only), creates
unverified `users` accounts per unique email, and writes legacy participations.
Results entries with no matching runner row (no email) are reported, not imported.

**Team / captain / slot**:
The legacy team-registration stack (`teams`, `runners`, `slot_counter`). Frozen with
the completed warsaw-2026 event; never revived for the individual series, which uses
`event_registrations` keyed by `event_slug` with no team concept.
