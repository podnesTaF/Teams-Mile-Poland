# A roster has no size limit; only the race composition has a size

Until September 2026 a team's roster was bounded on both sides: men's and women's
teams held 7 to 11 members, mixed teams 8 to 12 with at least four of each sex
(`TEAM_LIMITS`). The lower bound was **Complete**, shown everywhere as "x of 7";
the upper bound was the **Roster cap**, at which invitations and accepts were
refused and the invite form went grey. We decided to **remove both bounds**. A
roster is unbounded: a team invites and accepts as many runners as it likes, the
extra ones are reserves on the night, and no surface writes the roster count as
"x of N" — only the plain number.

The one size the platform still judges is the **race composition**
(`COMPOSITION` in `rating-rules.ts`: 3 RACERS + 2 pairs, or 4 + 2 for mixed with
four male RACERS and two female pairs). It is read in exactly two places: at
**team entry**, where `entryShortfall` refuses a team that could not name a
composition ("N more runners needed"), and at **team check-in**, where the
composition itself is validated. Neither is a roster rule.

## Considered options

- **Keep the lower bound as a roster property ("Complete") and drop only the
  cap.** Rejected: "Complete" was the thing shown as "x of 7", and a threshold
  that is only ever read at entry belongs to entry, not to the roster.
- **Keep a soft cap and warn past it.** Rejected: the owner's rule is that the
  buffer is the team's business; a warning is a limit with worse manners.
- **Drop the entry check too and let check-in catch a short team.** Rejected: a
  team of five that enters mints five registrations, tickets and consent links
  for a race it cannot start, and the failure would surface at the desk on the
  night.

## Consequences

- `TEAM_LIMITS`, `roster_full` and `sex_balance` are gone from `config.ts`;
  `checkEligibility` refuses only `already_member`, `wrong_category` and
  `already_in_category`. The `(user_id, category)` unique index is unchanged.
- `computeCompleteness` / `TeamCompleteness` became `summarizeRoster` /
  `RosterSummary` (count and men/women split). The entry gate reads
  `entryShortfall`, which is where the 7 / 8+4+4 now lives, derived from the
  composition rather than declared twice.
- The public team card and tile, the roster tile, the profile's "My teams", the
  admin index and detail, and the three roster emails show a plain count. The
  invite form is never disabled, and open invitations are not counted.
- The recruiting list subtitle no longer speaks of "free seats". The regulation
  text (`team-rules` §2.3.1) still names 11/12 and should be corrected by the
  owner; the platform no longer enforces it.
- The frozen legacy `src/features/team/*` (ADR 0008) keeps its captain-declared
  `size`; it is not touched by this decision.
