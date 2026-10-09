# Four placement teams run the team format; a runner's race follows their roster, and self-service formation is closed

Decided with the owner on 2026-10-09, for 10.10 and every night after. Changes
PRD #57 (team formation), PRD #64 (team entry and race day) and ADR 0009 (a
mixed night asks the runner which path they take). The plan, with file anchors
and the rejected alternatives, is `planning/organiser-placed-teams/README.md`;
it is filed as PRD #81 (slices #82–#85).

From 10.10 the team format is run by four standing teams — **Ace Battle Mile
RED Warsaw** and **BLACK Warsaw**, men's and women's — and nobody else. The
platform offered the opposite: a public recruiting list, team creation, join
requests by code, and a manager-driven team entry that never ran in production
(zero `team_entries` rows; 22.09 and 01.10 ran the team format from the timing
sheet alone).

## Decisions

1. **Four placement teams.** `PLACEMENT_TEAM_SLUGS` in
   `features/teams/config.ts`: `ab-praga-poludnie` (RED men),
   `ab-wilanow` (BLACK men), `ab-praga-poludnie-2` (RED women),
   `ab-wilanow-2` (BLACK women). A placement team is **entered on every night
   with a team path by definition** — no row, no action, no fee, nothing at
   event creation.

2. **The race is derived, never chosen.** A runner who is a member of a
   placement team at the moment they register runs the **team race**; anyone
   else runs the **individual mile**. The confirm card tells the runner which
   race they are confirming.

3. **Recorded per registration.** Migration 0031 on `event_registrations`:
   `race_format` (`text`, `"individual" | "team"`, not null, default
   `individual`) and `team_id` (`uuid`, null, references `user_teams(id)` on
   delete set null) — per night, because membership changes between nights.
   The migration backfills registrations on `registration_open` nights whose
   runner is on a placement roster; completed nights are left alone (their team
   runners are in `team_results`). Not `team_entry_id`. Every registration write
   path — the register action, the Stripe fulfilment, the admin comp — derives
   the two columns the same way.

4. **Price.** The team race is **free**; the individual mile costs the night's
   `individual_price_pln` (25 zł) by card. A `team` registration takes the free
   branch of `registerForEvent` regardless of the event's prices.
   `team_price_pln` is read by nothing public, and the event page no longer
   prints a team price.

5. **Email on registering.** The `confirmation` email gains a **team variant**
   ("Congratulations — you run for RED on 17 October"): the ticket as today,
   plus "a few days before the night we will ask you to confirm you are coming;
   your manager then composes the team". Same `event_email_log` kind, same
   idempotency key, three locales.

6. **Confirming and composing** use the existing attendance flow: the 3d / 1d
   reminders carry the confirm link and the row flips to `confirmed`. The
   manager composes the team **by hand** from the admin roster filtered to the
   team and `confirmed`. No composition editor, no team check-in: team-race
   runners check in on the ordinary desk and lease a bib.

7. **One door on the event page.** A `mixed` night shows the one register CTA,
   the individual price only, and a four-line explainer: the team race is for
   RED and BLACK members and free; the individual rated mile costs the night's
   price; a runner without a team runs one rated mile, the managers invite
   rated runners into a team, and from the next night they run with it. The
   sticky bar offers the same CTA. A pure `team` night keeps its notice, with
   the CTA pointed at the register flow. The register page drops "Enter through
   your team instead" and shows the explainer, shortened.

8. **Managers still invite — into the four teams only.** The invite form on
   `/teams/[slug]`, the admin invite-on-behalf, `/teams/invite/[token]` and the
   profile's pending-invitations list stay. Inviting, resending and accepting
   refuse `not_placement_team` for any other team; declining stays open.

9. **Creating a team is impossible.** `/teams/new` is removed and 404s;
   `createTeam` refuses `creation_closed`.

10. **Joining is by invitation only.** `/teams/join/[code]` is removed and
    404s; `requestToJoin`, `withdrawJoinRequest`, `decideJoinRequest` and
    `rotateTeamCode` refuse `paused`. The 16 pending join requests and every
    team's code stay as data, read only by admin.

11. **The "Find a team" page is removed.** `/teams` 404s, the landing button
    and every link to it go, and the team page's back-link points at the
    profile. The `recruiting` flag stops meaning anything publicly; it stays an
    admin hint.

12. **Removed, paused, hidden, kept.** *Removed outright*: `/teams`,
    `/teams/new`, `/teams/join/[code]`, team creation, join requests, team
    codes, membership outside the four teams. *Paused behind
    `TEAM_FORMATION_ENABLED=1`* (`isTeamFormationEnabled()`, unset = off, the
    same shape as `isTreasuryPayoutEnabled`): manager team entry and
    withdrawal (`/teams/[slug]/entries/[eventSlug]`, `enterTeam`,
    `withdrawEntry`) and the treasury (`/teams/[slug]/treasury`, contributions,
    payouts) — PRD #64 machinery that may come back as the second step; with
    the switch off the routes 404 and the actions refuse `paused`. *Hidden*:
    the event page's team door and its team price, the register page's team
    link, the profile's create button and join-requests list, the team page's
    join CTA, code block, enter button, entry list and treasury panel. *Kept*:
    `/teams/[slug]`, the profile Teams tab (my teams and invitations), all of
    `/admin/teams`.

13. **Heats, results and rewards are unchanged.** The owner builds team heats by
    hand; results come from the sheet import into `team_results` by name;
    participation ACER is paid per starter.

14. **A rating is not a gate.** "The managers invite rated runners" is copy;
    the platform does not check for a result before an invitation.

## Considered and rejected

- **A `team_entries` row per placement team per night**, with members attached
  by `team_entry_id`. It would light up the composition editor, the one-link
  confirm and team check-in — none of which has run in production, and team
  check-in would move the four teams off the desk that worked twice. The
  natural second step once a night has run on the derived race; the columns in
  decision 3 do not block it.
- **A member-aware CTA on the event page.** The page is statically generated
  and cannot know membership; the register page gives a member the right card
  one click later.
- **Admin placement of individual registrations.** Membership through
  invitations is the mechanism.
- **Dissolving the five other teams.** Results and treasuries reference them;
  they simply take no new members.

## Consequences

- ADR 0009's "the event page asks which path" no longer holds: a mixed night
  has one door, and the path follows the roster.
- `TeamActionReason` gains `paused`, `not_placement_team` and
  `creation_closed`, each with copy in `teams.reasons` ×3 and in the admin
  refusal catalog.
- Turning `TEAM_FORMATION_ENABLED=1` back on restores team entry and the
  treasury exactly as PRD #64 shipped them; it does not reopen creation, codes
  or join requests.
