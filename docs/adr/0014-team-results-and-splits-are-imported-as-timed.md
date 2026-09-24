# Team results and splits are imported as the timing file scored them

The first team night (22.09.2026, `mile-2026-09-22`) ran without any platform
team entry: two teams were put together on the spot, raced three heats, and
the timing operator sent one sheet with team banners, a role per runner
(`Pacer-N` = ACE, `Joker-N` = JOKER, blank = RACER), the ACE's handover
reading, and a reading at every mat (`9 m`, `109 m` … `1609 m`). Decided
2026-09-24 while importing it.

## Decisions

1. **A team run is stored as the file scored it.** New table `team_results`
   (migration 0029): `(event_slug, heat_number, team_name)` unique, the place
   in the heat, the team time, and `team_id` when the name matches exactly one
   `user_teams` row (case-insensitive, accents *not* folded — "AB Praga-Poludnie"
   and "AB PRAGA POŁUDNIE" are two platform teams). The runners' rows stay in
   `event_results` and point at it through `team_result_id`. PRD #65's derived
   model (stage times from zone readings against the check-in composition, pair
   penalties, leagues) is not built; when it is, it can fill the same columns.
   On 22.09 the team time was the plain sum of four miles (two RACERS, two
   pairs) with no penalty, which is what the file says and what is stored.

2. **A partial leg is never a mile.** `event_results.time_cs` stays the mile
   and is null for an ACE or JOKER; their figure is `leg_time_cs` (ACE: handover
   reading, JOKER: finish = the pair's mile), with `race_role` and `pair_no`.
   Every mile reader (leaderboard, profile best time, level, finals seeding)
   reads `time_cs`, so a RACER's mile in a team heat counts as an individual
   mile and a leg cannot. The profile reads legs separately (`getTeamLegs`).

3. **`(heat, bib)` is no longer a row identity for team rows.** Two teams in
   one heat wore the same seat numbers, and one runner had no bib. `bib` is
   nullable; the unique index is now partial — `(event_slug, heat_number, bib)`
   for individual rows, `(team_result_id, bib)` for team rows. Import-time
   links from a registration to its result ("direct refs") are by row id.

4. **Splits are stored for every import, individual or team.** `event_results.splits`
   is jsonb `[{ m, cs }]`, cumulative gun-relative readings, read from any `<n> m`
   header column. The RaceResult "Results by Heat" export has always carried
   these columns (08-22, 08-29); the parser used to discard them. Laps are
   computed on display, never stored.

5. **Linking gains a date-of-birth rule.** After the `(heat, bib)` lease and the
   exact name key, a row whose file carries a DoB links to the one registrant
   with that DoB sharing a name token ("Vladislav"/"Vladyslav"). Unique or
   nothing, like the other two.

## Consequences

- Nights imported before 0029 have no splits until their file is re-imported
  (replace-per-heat is idempotent, but re-check that links survive).
- The one-off `scripts/import-0922-results.ts` also created registrations for
  seven account holders who raced unregistered; the admin Results tab does not
  create registrations — a team runner with no registration stays unlinked.
- The team layout is detected by its `Joker` header; a different operator
  template needs a parser change.
