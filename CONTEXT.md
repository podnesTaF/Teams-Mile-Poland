# Teams Mile

The event site for the Teams Mile running events: one completed legacy team race
(`warsaw-2026`) and the Aug-2026 individual mile series, all at a single Warsaw stadium.

## Language

### Events

**Event**:
A single mile race in the series. A row in the `events` table, read through
`src/lib/events/store.ts` (ADR 0005); creating one is an admin action, not a
deploy.
_Avoid_: race (ambiguous), meet

**Event series**:
The set of individual mile events in Aug-2026, sharing one venue. The `individual`
rows.

**Event lifecycle status**:
Where an event sits in its timeline: `draft → upcoming → registration_open →
registration_closed → completed`, plus `cancelled`. A property of the event —
never of a registration.
_Avoid_: event state, stage

**Event type**:
`individual` (per-person registration), `team` (entered by team managers; also
the legacy warsaw-2026 stack) or `mixed` (both paths on one night, from
2026-09-22 — ADR 0009). Selects which entry flow a page offers. Code asks
`acceptsIndividuals` / `acceptsTeams`, never a literal, so a mixed night is
admitted wherever either path is.
_Avoid_: format (that is the team format vs. the individual mile), hybrid

**Mixed night**:
A `mixed`-type event. A runner joins it by exactly one path — registering alone
or being entered by their team — and the event page asks which first. One
`event_registrations` row per person per night either way; a team-entered row
carries `team_entry_id`. The corpus a runner signs follows their path, not the
night. Heats on a mixed night are team heats (a teams figure is set) or
individual heats (none), never both at once.
_Avoid_: combined event, double event, open night

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

### Consent

**Consent record**:
One append-only `registration_consents` row: a single thing the runner ticked,
bound to the registration it covers, naming the document, its version, the locale
shown, the moment, and the request IP. Never updated (ADR 0006).
_Avoid_: agreement, terms row, signature

**Acceptance / Declaration / Consent**:
The three `kind`s a consent record can be, and they are not interchangeable. An
**acceptance** binds the runner to a document (the Rules). A **declaration** is
testimony about a moment ("I am 18 and fit to run") and cannot be withdrawn,
because it was true or false when made. A **consent** is GDPR art. 6(1)(a) —
today only image use — and is the only kind that may carry a `withdrawnAt`.
_Avoid_: using "consent" loosely for all three

**Statement**:
The Oświadczenie — the one document in each set that is personalised, and so the
only printable per-registration artifact. Every other document is static text
identified by version alone.
_Avoid_: waiver, form, disclaimer

**Document version**:
The declared version string in the legal manifest, e.g. `2026-08-20`. What a
consent record stores, and what `version → commit → bytes` reconstructs from git.
A bump never invalidates consent already given; re-acceptance is a deliberate
campaign, so two runners in one event may hold consent against different versions.
_Avoid_: revision, doc hash (the hash guards the bytes; the version names them)

**Snapshot**:
The frozen copy of the runner's details written into a consent record at
acceptance. Deliberately duplicates `users` data and is expected to drift from it
— a statement rendered from the live profile would be a reconstruction, not a
record.
_Avoid_: cached fields, denormalised profile

**Signature block**:
What replaces the handwritten signature line in the Statement: an attestation
rendered from the consent record (name, moment, document version, IP, record id).
Acceptance here is a checkbox plus evidence; there is no wet signature and no
drawn one.
_Avoid_: e-signature, signed copy

### Outreach

**User broadcast**:
An admin-composed one-off email sent to an audience segment of `users`. Lives in
the event-mailings world; deduped per (user, broadcast). Distinct from the frozen
legacy team broadcast (which targets the `runners` table) and from automated
lifecycle emails.
_Avoid_: newsletter (no subscription list exists), campaign

**Audience segment**:
A named, queryable slice of `users` a broadcast can target (e.g. first-event
attended, first-event no-show, not registered for any Aug event, or — per mile
night — all registrations / awaiting confirmation / confirmed). Always excludes
opted-out users. Confirmation splits are per event because Confirmation is a
property of a registration, not of the user.

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

### Teams (current — team format)

**Team**:
A standing roster of runners with a unique name, owned by a user account, that
outlives any single event. A team is created once and then *enters* team-type
events; it is not created by registering. Distinct from the frozen legacy `teams`
table (see Legacy below) and from **Club** (the free-text field on a profile).
_Avoid_: squad, crew, group, club (that is the free-text profile field)

**Team category**:
Men, women, or mixed — fixed when the team is created. Decides who may join (men's
teams take `M`, women's take `F`, mixed take both) and the team's numbers — see
**Roster limits**. A runner holds at most one membership per category, so at most two
teams: their own sex category and one mixed.
_Avoid_: division, gender (of a team), type (that is the event type)

**Roster limits**:
Men's and women's teams hold 7 to 11 members; mixed teams 8 to 12 with at least 4 of
each sex. The lower bound is **Complete**; the upper bound is the **Roster cap**, at
which invitations and accepts are refused. On a mixed team a member is refused when
their sex could no longer leave room for four of the other (so at most 8 of one sex).
_Avoid_: team size (the legacy captain-declared number), capacity (that is a heat)

**Member**:
A runner on a team's roster — a `users` account, never a separate per-person row.
Becomes one by accepting an **Invitation** or having a **Join request** accepted;
both require a complete profile, because eligibility is read from `sex`.
_Avoid_: player, participant, runner row

**Team entry**:
A team's registration into one team-type event — the team-level counterpart of a
runner's **Registration**. One team, one event, at most once.
_Avoid_: team registration (ambiguous with creating the team), team signup

**Complete (team)**:
A roster property: the team has reached the lower **Roster limit** — 7 members, or 8
with at least 4 of each sex for mixed — all with complete profiles. Read at admission
into an event, never a stored flag; a team drops back to incomplete when someone
leaves. The regulation text (`team-rules` §2.3.1) currently states 11/12 and is to be
corrected to match.
_Avoid_: full (a full team can still take members; complete is a threshold), ready

**Race composition**:
The 7 members (8 for mixed) of a team entry who actually run, each holding a **Race
role**. Fixed at check-in on event day, on the team entry — never on the roster.
Men's and women's: 3 RACER + 2 ACE + 2 JOKER; mixed: 4 RACER + 2 ACE + 2 JOKER.
_Avoid_: lineup, squad, starting seven

**Race role**:
What a member does in one race: **RACER** runs the full mile; **ACE** runs to the
joker zone and hands over the mace; **JOKER** takes the mace and finishes. ACE and
JOKER form a pair. A race role belongs to a race composition, not to the member — the
same runner may be a RACER one night and a JOKER the next.
_Avoid_: position, team role (that is manager / member)

**Manager**:
The one member who owns a team on the platform: creates it, invites, accepts join
requests, and is the organiser's contact. A manager is also a runner on the roster. The
role can be handed to another member; a team always has exactly one.
_Avoid_: owner, admin (of a team), leader, captain (see below)

**Captain**:
A rules term (team rules §2.3.3) for the runner who speaks for the team on race day.
Not a platform role in team formation; expected to be picked with the race composition
at check-in. Never use it for the **Manager**.
_Avoid_: using it for the team owner

**Recruiting**:
A team's declared state of wanting more runners. Set by the manager (first asked at
creation), it lists the team publicly for join requests and marks it in admin for the
organiser to place solo runners. Off means the roster is considered full by the team.
_Avoid_: open (that is a legacy team status), looking-for-players

**Invitation**:
A manager's offer to one email address to join the team: a persisted, single-use,
expiring record with a status (pending → accepted / declined / revoked / expired).
Addressed to an email, but accepted by whichever account opens it. Resending reissues
the same invitation rather than creating a second one.
_Avoid_: invite link (the link is a view of the invitation), invite code (that is the
team code)

**Team code**:
A short, typable, rotatable identifier a manager shares so runners can find the team
and ask to join. Knowing the code never admits anyone by itself — it only lets you
knock. Distinct from the legacy code, which was the invite.
_Avoid_: invite code, join code, password

**Join request**:
A signed-in runner's ask to become a member, created by entering the team code or
from the public recruiting list. Pending until the manager accepts or declines, or the
runner withdraws. The mirror image of an **Invitation**: the runner initiates.
_Avoid_: application, request (bare), candidacy

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

**Legacy team / captain / slot**:
The legacy team-registration stack (`teams`, `runners`, `slot_counter`). Frozen with
the completed warsaw-2026 event; never revived for the individual series, which uses
`event_registrations` keyed by `event_slug` with no team concept.
