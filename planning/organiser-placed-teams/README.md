# Plan — RED and BLACK are entered on every night by default; their members register for the team race free and get a "you run for your team" email; everyone else runs a rated mile for 25 zł; self-service formation is paused

Decided with the owner on 2026-10-09 (third pass). Applies to **10.10** (tomorrow) and every
night after. Touches PRD #57 (formation), #64 (team entry) and ADR 0009 (mixed nights): the
self-service and manager-entry paths are switched off, a placement team is entered on every
mixed night by definition, and a runner's race follows their roster membership.

## The rule

Four standing **placement teams** run the team format on every coming night: **Ace Battle Mile
RED Warsaw** and **BLACK Warsaw**, men's and women's. They are entered by default — no manager
action, no fee, nothing to press at event creation. A runner on one of those rosters opens the
event page and has **one thing to do: register for the team race, free**. On registering they get
an email — *Congratulations, you run for RED at this night* — and then the standard flow: a
reminder a couple of days before asks them to confirm they are coming, and the manager composes
the team for the night from the confirmed members. Everyone else, on the platform or not, with or
without a rating, registers for the **individual rated mile at 25 zł**; the managers invite rated
runners into a team afterwards, and from the next night that runner runs with it. Nobody finds,
founds or asks to join a team on the site any more; managers and admins invite.

## What exists today (read before touching anything)

| Fact | Where | Why it matters |
|---|---|---|
| 10.10, 17.10, 24.10: `mixed`, `registration_open`, `individual_price_pln = 25` on all three; `team_price_pln = 40` on 10.10 only. ACER fees are ignored where a PLN price exists (ADR 0015). | `events` rows | "Team entry · 40 zł" on the 10.10 page is the line to remove. 25 zł is already set; nothing to re-price. |
| 10.10 has 3 registrations: spak17@ (individual, unpaid, 21.09), **podnes@ (RED member, paid 25 zł on 02.10, already checked in)**, design@smelo (test team, paid 25 zł). | `event_registrations`, `event_payments` | podnes@'s row becomes a team-race row by backfill; his 25 zł is a test payment — refund is the owner's call, not the slice's. |
| **Zero `team_entries` rows ever.** 22.09 and 01.10 ran the team format with no entry; results came from the sheet, linked to platform teams by name. | `team_entries`, `scripts/import-*-results.ts` | PRD #64's entry, confirm-link, composition editor and Teams-desk check-in are untested in production. With 10.10 tomorrow they stay off; the race is derived, not entered. |
| RED men (`ab-praga-poludnie`, 8), BLACK men (`ab-wilanow`, 2), RED women (`ab-praga-poludnie-2`, 1), BLACK women (`ab-wilanow-2`, 2). Five other teams. | `user_teams`, `user_team_members` | These four slugs are the placement teams. |
| `team_results` for 22.09 / 01.10 link to RED and BLACK men's. | `team_results.team_id` | Same ids, results and rating stay on one identity. |
| 8 pending invitations, 16 pending join requests. | `user_team_invitations`, `user_team_join_requests` | Invitations stay live (managers invite). Join requests are paused and left as data. |
| Registration write paths: `registerForEvent` → `createRegistrationWithConsent` (free), `event_payments` → `fulfil.ts` → same (card), and the admin's `createFreeRegistration` from `/admin/users/[id]` (comp). | `features/event-registration/actions.ts`, `data.ts`, `features/event-payments/fulfil.ts`, `features/admin/users-actions.ts` | All three derive the race from membership. The admin path is how a manager "adds themselves or a member" by hand. |
| Registration sends a `confirmation` email (the ticket); the cron sends `reminder_7d/3d/1d` and `morning`; attendance confirmation flips `registered → confirmed` (#28). `send()` returns `{error}`, never throws. | `event_email_log`, `/api/cron/mailings`, ticket sender | The congratulations is a **team variant of the confirmation email**, not a second mail. The "confirm a couple of days before" step already exists. |
| Event page is SSG (`revalidate = 300`); its CTA is a client island on `authClient.useSession()`. | `events/[slug]/page.tsx`, `event-register-cta.tsx` | The page cannot know membership at render time; the register page (dynamic) decides. |
| Admin roster: tick-rows, bulk-move bar, Status column (registered / confirmed / checked in). | `roster-table.tsx` | A Race column + filter gives the manager the "who is coming for RED" view to compose from. |
| Switch precedent: `TREASURY_PAYOUTS_ENABLED=1`, default off. | `features/wallet/transfers.ts` | Same shape for pausing formation. |
| Working tree (uncommitted, 2026-10-09): `teamEvent.joinFree`, header sign-up CTA, spam note. | `git status` | Commit or stash first; the event page and confirm card are edited below. |

## Decisions (become ADR 0016)

| Question | Decision |
|---|---|
| Which teams, and how are they entered? | `PLACEMENT_TEAM_SLUGS` in `features/teams/config.ts`: the four RED/BLACK slugs. A placement team is **entered on every night with a team path by definition** — no row, no action, no fee. `enterTeam` (PRD #64) refuses while paused; nothing at event creation. |
| Who runs the team race? | A runner who is a **member of a placement team at the moment they register**. Derived, never chosen: member → `team`, anyone else → `individual`. The confirm card tells the runner which race they are confirming. |
| Recorded how? | Migration 0031 on `event_registrations`: **`race_format`** `text` `$type<"individual" \| "team">` `not null default 'individual'`; **`team_id`** `uuid null references user_teams(id) on delete set null`. Per night, because membership changes between nights. The migration **backfills** existing open-night rows: every registration on a `registration_open` event whose user is on a placement roster becomes `team` + that team (today that is podnes@ on 10.10). Completed nights are left alone — their team runners are in `team_results`. Not `team_entry_id`. |
| Price | **Team race free; individual mile the night's `individual_price_pln` (25 zł) by card.** A `team` registration takes the existing free branch in `registerForEvent` regardless of the event's prices. `team_price_pln` is read by nothing public; the event page stops printing it. |
| Email on registering | The `confirmation` email gains a **team variant**: subject "Congratulations — you run for RED on 17 October", body: the ticket as today + "a few days before the night we will ask you to confirm you are coming; your manager then composes the team". Same `event_email_log` kind, same idempotency key, three locales. |
| Confirming and composing | The existing attendance flow: reminders `3d` / `1d` carry the confirm link, the row flips to `confirmed`. The manager composes the team **by hand** from the roster filtered to Team · RED and `confirmed` (as on 22.09 / 01.10). No composition editor, no team check-in: team-race runners check in on the ordinary desk and lease a bib. |
| Event page (static) | One entry card on a `mixed` night: the Register CTA, the individual price line only, and the explainer — *Team race: RED and BLACK members, free; register and your team is recognised. Individual rated mile: 25 zł. Not on a team yet? Run one rated mile; the managers invite rated runners into a team and from the next night you run with it.* The pure-`team` branch keeps its notice with the CTA pointed at the register flow. |
| Register page (dynamic) | Member: confirm card "Team race · RED", cost "Free", one consent block, the individual corpus (they register alone). Non-member: today's 25 zł card plus the explainer. Guest: today's form plus the explainer; membership is read after sign-in. Already registered: today's "view ticket" state, now naming the race. |
| Afterwards | Ticket, profile races card and admin roster say "Team race — RED" or "Individual mile". |
| Managers still invite | **Invitations stay live, for the four placement teams only**: the invite form on `/teams/[slug]`, admin invite-on-behalf, `/teams/invite/[token]`, the profile's pending-invitations list. `inviteMember` and `acceptInvitation` refuse (`not_placement_team`) for any other team, so the five remaining teams can take no new members. All 8 pending invitations today are RED's, so nothing live breaks. |
| Creating a team | **Impossible.** `/teams/new` is removed from navigation and 404s, `createTeam` refuses. Not a switch: the owner's rule is that only the four teams exist as destinations, and the recruiting list below goes with it. |
| Joining a team | **Only by a manager's or admin's invitation, only into the four teams.** No team codes, no join requests, no public list. The copy on the event page and the FAQ says so: *the managers invite rated runners*. |
| The "Find a team" page | **Removed**, not paused: `/teams` 404s, the landing "Find a team" button and every link to it go, the recruiting flag stops meaning anything publicly (it stays an admin hint). The team page's "All teams" back-link points at the profile instead. |
| Paused vs removed | Two tiers. **Removed outright** (the three rows above): `/teams`, `/teams/new`, `/teams/join/[code]`, `createTeam`, join requests, team codes, membership outside the four teams. **Paused behind `TEAM_FORMATION_ENABLED=1`** (unset = off, `isTeamFormationEnabled()`): manager team entry and withdrawal (`/teams/[slug]/entries/[eventSlug]`), treasury contributions and payouts (`/teams/[slug]/treasury`) — PRD #64 machinery that may come back as the second step. **Hidden**: event-page team door and its 40 zł line, "Enter through your team instead", profile create button and join-requests list, team page join CTA / code block / enter button. **Kept**: `/teams/[slug]`, profile Teams tab (my teams + invitations), all of `/admin/teams`. The admin event Teams tab stays but is empty; the roster filter is the working view. |
| Heats | Untouched; the owner builds team heats by hand. *Generate* still seeds every registration into individual heats — the Race column shows whom to pull. |
| Results, rewards | Unchanged: sheet import, `team_results` by name, participation ACER per starter. |
| Rating as a gate | Copy only; the platform does not check for a result before an invitation. |

## Considered and rejected

- **Auto-create a `team_entries` row per placement team per night and attach members by
  `team_entry_id`.** Would light up the Teams tab, the composition editor, the one-link confirm
  and team check-in. Rejected for now: none of it has run in production, 10.10 is tomorrow, and
  team check-in would move the four teams off the desk that worked twice. It is the natural
  second step once a night has run on the derived race — the columns above do not block it.
- **A member-aware CTA island on the event page.** Deferred; needs a membership endpoint on an
  SSG page. The register page gives the member the right card one click later.
- **Admin placement of individual registrations.** Dropped; membership through invitations is
  the mechanism.
- **Dissolving the five other teams.** Results and treasuries reference them; pausing hides them.

## Slices — PRD #81; slices #82 → #83 → #84 → #85 (filed 2026-10-09)

1. **#82 — Close formation + one door** (no schema). Remove `/teams`, `/teams/new`, `/teams/join/[code]`
   and their links; `createTeam`, join-request and rotate-code actions refuse; `inviteMember` /
   `acceptInvitation` check `PLACEMENT_TEAM_SLUGS`; `isTeamFormationEnabled()` guards entry and
   treasury; hide the link sites and the 40 zł line; event page on a mixed night renders one
   entry card with the explainer ("managers invite rated runners"); register card loses the
   team-alternative link; profile tab keeps my teams + invitations, loses create and join
   requests. Fold out the uncommitted `joinFree`. Clear `.next` before the build (removed routes).
2. **#83 — Race follows membership** (migration 0031 with backfill). `PLACEMENT_TEAM_SLUGS`; a
   `placementTeamFor(userId)` reader; `registerForEvent`, `fulfil.ts` and `createFreeRegistration`
   write `race_format` + `team_id` and take the free branch for `team`; confirm card and
   already-registered state name the race; ticket and profile races card show it; the team
   variant of the confirmation email; three locales. Verify on 10.10 with podnes@'s backfilled
   row and a fresh RED member registering.
3. **#84 — Admin roster: Race column + filter** (Mile / Team · RED men / … four teams), in the
   export too. English-only. Small; same day if time allows.
4. **#85 — Copy pass**: FAQ "Can I come without a team?", team-rules §2.2 link, reminder copy naming
   the team, pl/en/ua review.

Cross-cutting (docs/agents/cross-cutting-checklist.md): trilingual public strings; admin
English-only; existing gate chain; `draft`/`cancelled` unchanged; additive migration with its
backfill read before commit (and its `when` checked against the live watermark); `send()`
errors checked, never assumed thrown; no `eventType` literals.

## Settled with the owner (2026-10-09)

- Colours RED and BLACK; **women's RED/BLACK are placement teams too**.
- Teams are entered by default; managers do no entry step. Managers hold admin access and can
  register a member by hand from `/admin/users/[id]`.
- Team race free for members, with a congratulations email; individual mile 25 zł; the 40 zł
  team price leaves the page.
- Confirm-a-few-days-before and manager composition follow the existing reminder flow and are
  done by hand.
- No heat work.
- **Creating a team is impossible; joining is by invitation only, into the four teams; the "Find a team" page is removed** (2026-10-09, third message). All 8 pending invitations are RED's.
- **Applies to 10.10** regardless of its three registrations; podnes@'s row is backfilled to
  Team · RED.
