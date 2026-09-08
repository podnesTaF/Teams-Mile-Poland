# New team tables live beside the frozen legacy ones, prefixed `user_team_`

The team-format feature (Sept 2026) needs a standing, account-backed team model,
but the natural table name `teams` — with `runners` and `slot_counter` — belongs to
the frozen warsaw-2026 stack, which the cross-cutting checklist says is never
migrated or repurposed. We decided to add new tables next to it under the
`user_team_` prefix (`user_teams`, `user_team_members`, `user_team_invitations`,
`user_team_join_requests`) rather than rename the legacy tables to `legacy_*` and
take the clean names. The prefix states the real difference: these teams are owned
by, and populated from, `users` accounts, whereas legacy teams pre-date accounts and
persisted people in their own `runners` rows.

## Considered options

- **Rename legacy to `legacy_teams` / `legacy_runners` and reuse `teams`.** One
  `ALTER TABLE … RENAME` each, no data movement, and the Drizzle identifiers could
  keep their names so the frozen `/team` and `/join` pages stay untouched. Rejected:
  it is a migration on tables the project has promised not to touch, and it makes
  `teams` mean two different things across git history and old exports.
- **Reuse the legacy `teams` table** by adding columns. Rejected outright: its rows
  have no owner account, its `status` is a pgEnum, and its `code` was the invite.

## Consequences

- Statuses, roles and category on the new tables are `text().$type<>()`, never
  pgEnum (see the stranded-migration-0012 note in `src/db/schema/events.ts`).
- `user_team_members` carries a copy of the team's immutable `category` so the
  "one team per category per runner" rule is a plain unique index on
  `(user_id, category)`.
- The glossary distinguishes **Team** (current) from **Legacy team** so the two
  stacks are never conflated in code review.
