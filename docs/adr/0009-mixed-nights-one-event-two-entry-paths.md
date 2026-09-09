# A mixed night is one event with two entry paths, and a runner takes exactly one

From 22 September 2026 the series runs nights that host both the team format and
the individual mile (22.09, 01.10, 10.10). The owner's requirement: a participant
who wants to join is asked whether they run **in a team** or **the individual
mile**. We decided to model such a night as a single `events` row with a third
`event_type` value, `mixed`, and to keep the two existing entry flows exactly as
they are — the individual register flow (PRD #50/#53) and the team entry flow
(PRD #64) — each admitted by a predicate rather than by an `eventType` literal:

- `acceptsIndividuals(event)` — `individual` or `mixed`;
- `acceptsTeams(event)` — `team` or `mixed`, and not the frozen legacy night.

The choice the owner asked for lives where everyone lands before entering: the
event page's sidebar shows two doors on an open mixed night (register alone, or
enter through a team), and the register card keeps a one-line link to the other
door for people who deep-link.

## Decisions

1. **One row, one slug, one type.** Not two events on the same date sharing a
   venue: heats, bibs, tickets, statements and results are all keyed by
   `event_slug`, and a night has one bib pool and one timetable. Splitting the
   night would double every operational surface and let the two halves fall out
   of step (different status, different window).

2. **One person, one entry path per night.** `event_registrations` is unique on
   `(event_slug, user_id)`, and a team-entered member's row carries
   `team_entry_id`. The team entry action refuses (`registered_individually`,
   naming the member) when a roster member already holds an individual
   registration for that night, instead of letting the upsert adopt their row
   into the entry; the individual register card, seeing a `team_entry_id`, shows
   "entered with your team" and links to the team instead of offering a second
   registration. The rule is enforced in code on both paths because the
   database cannot tell the two kinds of row apart by constraint alone.

3. **The legal corpus follows the entry path, not the event.** The individual
   register flow always asks for the `individual` set and the team confirmation
   screen always for the `team` set. `DOC_SET_BY_EVENT_TYPE` (one set per type)
   became `DOC_SETS_BY_EVENT_TYPE` (the sets an event *publishes*); a mixed night
   publishes both, so both corpora have pages under `/events/[slug]/legal`, and
   each printed statement names its own document from the submission's stored
   `docSet`.

4. **A heat's kind is `capacity_teams is not null`.** A mixed night's card holds
   team heats and individual heats side by side; the admin generates each kind
   by filling or leaving blank the "Teams / heat" field. Team seating
   (`findHeatWithRoomForTeam`) considers only heats with a teams figure and
   walk-up seeding (`findHeatWithRoom`) only heats without one, on every event
   type — every heat a team night generates carries the figure, and no heat an
   individual night generates does, so the filters change nothing there. The
   public start list renders each heat as whatever it holds. No migration.

5. **The individual desk refuses a team-entered runner** (`team_member`): a team
   is checked in whole at the Teams desk, which fixes the composition and leases
   every bib in one transaction; a solo check-in would leave the entry half done.
   This applies on pure team nights as well, where the Check-in tab was already
   open.

6. **Admin lists read the whole current stack.** `getIndividualEvents` became
   `getStackEvents` (every non-legacy event); a pure team night was previously
   invisible in the admin events index and sidebar, reachable only by URL.
   `getSeriesEvents` (landing cards, reminder cron, profile "other nights") now
   admits mixed nights via `acceptsIndividuals` and still excludes pure team
   nights.

## Considered options

- **Two booleans on the row (`accepts_individuals`, `accepts_teams`).** More
  general, but every `Record<EventType, …>` total map would lose its
  exhaustiveness, and the create form would have to forbid the false/false
  combination. A third type value is a compile error wherever a map is total and
  a code-review flag wherever a literal comparison survives.
- **Two events per night linked by a `parent_slug`.** Rejected for the reasons
  in decision 1; it also puts two rows on the landing for one evening.
- **Let team entry adopt an individual registration silently** (the pre-existing
  upsert behaviour). Rejected: it changes what the runner agreed to (the team
  corpus, a manager who can withdraw them) without asking.

## Consequences

- `eventType === "individual"` / `=== "team"` comparisons remain only where the
  distinction is genuinely three-way (heat units on the admin card, the start
  list projection, the event page CTA). New shared surfaces must use the
  predicates.
- Reminder mailings (`getSeriesEvents` audience) now go to a mixed night's
  team-entered members too, with the individual-mile copy; team results (PRD
  #65) are still not built, so a mixed night's Results tab imports individual
  times only.
- Follow-ups: a mixed heat that ends up holding both a team and solo runners
  renders its team blocks only on the public start list; the reminder copy could
  gain a team variant.
