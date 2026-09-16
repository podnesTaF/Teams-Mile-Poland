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
teams take `M`, women's take `F`, mixed take both) and the team's **Race composition**.
A runner holds at most one membership per category, so at most two teams: their own
sex category and one mixed.
_Avoid_: division, gender (of a team), type (that is the event type)

**Roster**:
Everyone on a team, with no size limit (ADR 0011). A roster may carry as many reserves
as the manager wants; invitations and accepts are never refused for space, and no
surface shows the count as "x of N" — only the plain number. The only size the
platform judges is the **Race composition**, at **Team entry** and at **Team check-in**.
_Avoid_: roster limit, roster cap, complete/incomplete roster, team size (the legacy
captain-declared number), capacity (that is a heat)

**Member**:
A runner on a team's roster — a `users` account, never a separate per-person row.
Becomes one by accepting an **Invitation** or having a **Join request** accepted;
both require a complete profile, because eligibility is read from `sex`.
_Avoid_: player, participant, runner row

**Team entry**:
A team's registration into one team-type event, made by the **Manager** once the team
**Can enter**. Creates one **Registration** per entered member in the same
transaction, so tickets, consent, check-in, bibs, heats and results work unchanged.
One team, one event, at most once. Members confirm their own consent from one link;
the manager does everything else.
_Avoid_: team registration (ambiguous with creating the team), team signup

**Team check-in**:
The one on-site act, with the manager present, that fixes a team entry's **Race
composition** — roles, pairs and each pair's **Stage option** — validates it, and
leases a bib to every composed member. Replaces per-runner check-in for team events.
_Avoid_: roster confirmation, line-up submission

**Reserve**:
An entered member left out of the race composition at team check-in. Holds no bib and
is not checked in, but can be swapped in for an absent composed member until the heat
starts.
_Avoid_: bench, substitute (the act is a swap; the person is a reserve)

**Can enter (team)**:
A roster property read at **Team entry**, never stored: the roster has enough members
to field a **Race composition** — 7 for men's and women's teams, 8 with at least 4 men
and 4 women for mixed — all with complete profiles. The shortfall is reported as "N
more runners needed", never as "x of N". A roster larger than the composition is the
normal case: the extra members are **Reserves** on the night.
_Avoid_: complete (there is no roster target), full (a roster has no cap), ready

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

**Stage**:
The part of the mile one member of an ACE+JOKER pair runs. The ACE stage runs from
the start to the joker zone; the JOKER stage from the zone to the finish. Lengths are
**nominal**: the zone is 40–60 m before the line, so a pair declares one of the
**Stage options** — about 360+1249, 760+849 or 1160+449 m — and the ±10 m is accepted
as tolerance. A RACER has no stages.
_Avoid_: leg, split (a split is a timing reading; a stage is the distance)

**Stage time**:
The time one pair member took for their stage, read primarily from a timing point in
the joker zone and only as a fallback hand-entered by the zone judge. Two per pair per
race.
_Avoid_: lap time, partial

**Mile-equivalent**:
The mile time a stage time is worth: the stage time scaled to the nearest World
Athletics distance, converted to WA points for the runner's sex, and read back as the
mile time carrying the same points. What an ACE or JOKER's **Level** is computed from.
_Avoid_: adjusted time, virtual mile, WA points (an intermediate, never shown as the
result)

**Pair time**:
The ACE+JOKER pair's ranking time for the team result: ACE stage time + JOKER stage
time + 24 s (men) or 26 s (women). A team-result component only; nobody's personal
level is read from it.
_Avoid_: relay time, combined time

**Team time**:
A team's result in one race: the sum of its RACER mile times and its two pair times
(3 RACERS + 2 pairs; mixed: 4 male RACERS + 2 female pairs). Lower is better. Read
against the division table to place the team in a league and team level.
_Avoid_: team score, points

**Level**:
A runner's rating: the best (lowest-numbered) of the 16 AB-mile levels whose time bar
their best official mile-equivalent meets, sex-aware, from the Runners column. RACERS
use their mile time; ACEs and JOKERs their stage's **Mile-equivalent**. One level per
runner across all roles and races; derived at read time, never stored, never lowered.
There is no points system.
_Avoid_: rating (the level *is* the rating), rank (that is a position in a list),
grade, tier

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

**ACER**:
Prepaid platform credit held in a runner's wallet, pegged 1 ACER = 1 USD. The wallet
is an append-only ledger, so a balance is a sum over completed rows and never a stored
column. Earned by checking in and by referrals, bought when purchases are switched on,
**granted** by an admin, and spent on paid features — today the **Team creation fee**.
Colloquially "aces"; code, copy and UI never use that word, because **ACE** is a race role.
_Avoid_: aces, coins, tokens, points, credits (bare)

**Team creation fee**:
The 100 ACER a runner pays to found a team, debited from their wallet in the same
transaction that writes the team, so the team and the payment stand or fall together
(ADR 0010). Charged at formation only — a **Team entry** is free — and never refunded
when a team is dissolved; an admin reversal is the correction if a case ever warrants
one.
_Avoid_: team fee (ambiguous with an entry fee), subscription, deposit

**Grant**:
ACER credited to one or more accounts by an admin, with a mandatory reason recorded on
every row and the acting admin on it. A bulk grant credits everyone ticked on the users
list in one act, keyed by a batch so a second press of the button credits nobody twice.
Grants only ever credit — a hand-made debit stays on the per-user panel.
_Avoid_: bonus, top-up (that is a purchase), gift, adjustment (that is the per-user
credit or debit)

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
