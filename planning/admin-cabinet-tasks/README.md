# Admin/cabinet tasks — one file per agent

Split of `planning/admin-cabinet-tasks-plan.md` (client email 2026-08-18) into self-contained tasks. Each file carries its own context, file references, and acceptance criteria — hand one file to one agent; no other reading required.

Every task also implicitly inherits the repo ground rules: read `node_modules/next/dist/docs/` before writing Next.js code (custom Next 16 build); migrations additive-only, applied to a Neon branch first; `npm run typecheck && npm run lint && npm run build` before done; admin UI English-only, public UI trilingual (pl/en/ua key parity).

## Order & dependencies

| Task | Title | Size | Depends on | Blocked on client? |
|---|---|---|---|---|
| [01](01-aug29-cleanup.md) | Aug-29 fixture cleanup + participant list | S | — | owner confirm before delete |
| [02](02-fixture-script-guardrail.md) | Fixture scripts refuse live DB | S | — | — |
| [03](03-google-signin-verify.md) | Verify Google sign-in fix + regression guard | S | — | — |
| [04](04-users-list-fixes.md) | Users list: sort, pagination, phone, profile-complete stat | M | — | — |
| [05](05-admin-nav-capability-filter.md) | Nav capability filter + viewer sweep + stale cleanup | S | — | — |
| [06](06-scan-signin-and-next-loop.md) | Volunteer scan: sign-in affordance + scan-next loop | M | — | — (do before Aug 22/29) |
| [07](07-ticket-panel-parity.md) | Ticket panel: custom bib + no-show/undo | S/M | after 06 (same files) | — |
| [08](08-phone-e164-and-email-index.md) | E.164 phone key + lower(email) index | M | — | — |
| [09](09-admin-duplicates-report.md) | Admin duplicates report | M | 08 | — |
| [10](10-registration-duplicate-warning.md) | Registration-time duplicate flag | S | 08 | warn vs block |
| [11](11-unify-participation-definition.md) | Unify "races participated" definition | M | — | — |
| [12](12-admin-user-detail-results.md) | Admin user detail: results/level summary | M | 11 preferred | — |
| [13](13-person-level-leaderboard.md) | Person-level leaderboard | M | 11 preferred | points system? (default: best-time v1) |
| [14](14-referral-admin-drilldown.md) | Referral admin drill-down (optional) | M | 11 ideally | — |
| [15](15-wallet-spec.md) | Wallet PRD + client questions (no code) | S | — | answers gate the build tasks |

Parallelizable now: 01–06, 08, 11, 15 have no dependencies on each other (01+02 touch the same scripts — sequence or same agent; 06+07 same files — sequence).

Wallet build tasks (ledger, Stripe purchase) are deliberately not split yet — they get their own task files once task 15's questions are answered.

## Status (2026-08-19)

All tasks except 01 are implemented and committed (02–15, one commit each; `git log --grep "task 0"` finds them). Task 01 (Aug-29 cleanup) still needs a live `DATABASE_URL` session. Outstanding owner actions:
- Task 01: run the cleanup (`ALLOW_FIXTURES=1 … seed-heats-fixture.ts --teardown`) and pull the participant list.
- Task 08 runbook: email-case precheck → migrate 0019 on a Neon branch → backfill dry-run → `--write` (details in the migration header).
- Manual browser checks: Google linking (task 03, checklist in the phase log) and the volunteer scan flow (task 06, `docs/volunteer-checkin.md`).
- Send `planning/wallet-prd.md` questions to the client (task 15); answers unblock the wallet build tasks.
- Decide: delete the deprecated `/api/ticket/check-in` route (task 05) once confirmed no external scanner holds `CHECKIN_API_KEY`.
