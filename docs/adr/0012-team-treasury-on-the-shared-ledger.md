# A team's treasury is an owner on the shared ledger, and a transfer is two legs of one fact

From September 2026 a team holds ACER of its own — its **treasury** — on the
same `wallet_transactions` ledger that holds every runner's wallet. Members pay
in from their own wallets (**contribution**), the manager pays out to roster
members (**payout**), and admins credit or debit it with a reason (**grant**).
Future slices debit it for event entry fees and credit it with prizes; this ADR
lays the account down and the paths into and out of it, and deliberately stops
short of either.

Decided with the owner on 2026-09-17. The plan is in
`planning/team-treasury/README.md`.

## Decisions

1. **One ledger, an exclusive owner per row.** `wallet_transactions` gains a
   nullable `team_id`; `user_id` becomes nullable; the check constraint
   `wallet_tx_one_owner` says exactly one of them is set (migration 0027). A
   second `team_wallet_transactions` table was the obvious alternative and was
   rejected: a contribution is one fact with a leg on each side, and two ledgers
   must then agree about it across two writers, two balance functions, two
   history views and two admin panels. The single writer
   (`recordWalletTransaction`), the `SUM … WHERE status = 'completed'` balance,
   the paged history and the admin ledger all became owner-aware behind one
   `ownerWhere()` instead. Every pre-treasury caller still passes a bare user
   id and compiles unchanged.

2. **`team_id` carries no foreign key.** Dissolving a team is a hard delete of
   `user_teams` (PRD #57 decided against soft state), and the owner decided a
   dissolved team's treasury is **forfeited**, its rows kept. Each FK action
   contradicts that: `CASCADE` deletes money; `SET NULL` nulls both owner
   columns, so the check constraint fails the `DELETE` itself and dissolve
   becomes impossible the moment a treasury row exists; `RESTRICT` blocks
   dissolve outright. Without a key, rows of a dissolved team stay summable and
   reversible under an id nobody holds — the same "reference outlives its
   referent" shape as `team_entries.event_slug` (ADR 0005). Insert-time
   integrity comes from the write path instead (decision 4), which is stronger
   than a foreign key because it also holds off a concurrent dissolve. The
   asymmetry with `user_id`'s `CASCADE` is noted and left alone: deleting an
   account was already decided to take its ledger with it.

3. **A transfer is two rows in one transaction, keyed by a client-minted id.**
   `transferAcer` (`src/features/wallet/transfers.ts`) writes the payer's leg
   (negative) and the payee's leg (positive), same `kind`, under
   `transfer:<transferId>:out` and `:in`. The form mints the uuid per attempt
   and re-mints it after every result, so a double press replays an id the
   ledger already holds and writes nothing. Both legs record the pressing
   person in `created_by` and point at the counterparty in `reference`
   (`team:<slug>` on the wallet leg, `user:<id>` on the treasury leg) — the
   history then answers "who paid this in" without a memo nobody can translate.

4. **Lock modes chosen so a contribution and a payout never wait on each
   other.** The payer's row (`users` or `user_teams`) is taken `FOR NO KEY
   UPDATE`: it serialises two spends by one payer (and `createTeamRows`' own
   `FOR UPDATE`) without conflicting with the `KEY SHARE` a foreign key takes
   when a credit lands on that payer, so a Stripe webhook or a desk accrual
   never queues behind a spend. The payee's row is taken `FOR KEY SHARE`: it
   proves the payee exists at commit time and blocks a concurrent dissolve or
   account deletion until the movement is in the ledger, and it is compatible
   with the payee's own spend lock. A payout's roster check runs inside the
   same transaction on the seat row, also `FOR KEY SHARE`, so a concurrent
   removal waits and "the payee was a member when the money moved" holds. The
   verification script runs twenty rounds of a contribution racing a payout on
   one team and sees no `40P01`. Rule for any future operation that needs two
   *strong* locks: acquire `users` before `user_teams`.

5. **The replay lookup runs before the balance read.** Under the payer's lock,
   the `:out` leg is looked up first: a second submit would otherwise re-read a
   balance that already includes the first debit and come back as
   `insufficient_balance` instead of "already recorded". The same id with a
   different amount or kind is a stale form and is refused (`stale_form`)
   rather than silently swallowed. The `InsufficientAcerError` sentinel moved
   from `teams/creation.ts` to `wallet/errors.ts`, where the other transfer
   sentinels live; `creation.ts` re-exports it.

6. **A reversal reverses the whole transfer.** Reversing one leg alone would
   refund the member while the treasury still shows the money, or the other
   way round — minting or destroying ACER system-wide. `reverseRows`
   (`src/features/admin/wallet-reverse.ts`), shared by the runner panel and the
   treasury panel, finds the sibling by the shared key stem and writes both
   `reversal` rows in one transaction, each on its own leg's owner, keyed
   `reversal:<txId>` so a double press does nothing. Reversing a payout can
   leave a member's wallet negative; that is accepted for a correction. A plain
   grant to a team reverses as one row, as before.

7. **Payouts ship behind `TREASURY_PAYOUTS_ENABLED=1`.** The Terms of Use say
   ACER "is not transferable — it cannot be moved to another user", and a payout
   does exactly that. The owner chose to build everything and gate payouts until
   the clause is revised with counsel: the payout form is absent (not disabled)
   and the action refuses `payouts_disabled` while the flag is unset — the
   `isAcerPurchaseEnabled` shape, non-`NEXT_PUBLIC_` because the server decides
   whether money moves. Contributions and grants are not gated: they move money
   into a team, not to another person. The wallet-page purchase copy that said
   "not transferable" now says "inside the platform only, in your wallet or your
   team's treasury"; the Terms text itself is not edited here.

8. **Any member may contribute; only the manager pays out; admins grant.**
   `requireTeamMember` is a new gate that an admin does **not** short-circuit —
   a contribution moves the actor's own money, so the actor must hold a seat —
   while payouts run through `requireTeamManagerOrAdmin` as every manager action
   does. Admin grants reuse `admin_credit` / `admin_debit` on a team owner (ADR
   0010 decision 9: one name per fact), through `treasury-actions.ts`, a
   sibling of `wallet-actions.ts` rather than a branch inside it, because that
   module's redirect is the user page's. Form parsing is shared
   (`wallet-form.ts`) so a runner grant and a team grant refuse the same typos
   with the same sentences.

9. **Forfeiture on dissolve, hand-over and leave.** Nothing in the ledger moves
   when a team is dissolved, its manager changes, or a member leaves or is
   removed; the treasury belongs to the team. The dissolve confirmation names
   the balance and suggests paying it out first. Post-dissolve, the correction
   path still works: reversing a member's contribution leg from their admin
   panel reverses the treasury leg too (decision 6), netting the dead team's
   rows to zero.

10. **`team_entry_fee` is declared, not written.** The reserved kind (like
    `prize_reward`) is the seam for the fee slice; no unused debit helper ships
    with it. ADR 0010's "entering an event as a team stays free" remains true.

## Considered options

- **Separate `team_wallet_transactions` table.** Rejected — decision 1.
- **A `wallet_accounts` indirection** (every ledger row references an account
  row that is a user or a team). The cleanest model on paper, and the one to
  reach for if a third owner kind ever appears; rejected now because it means
  backfilling an account for every user with ledger rows and rewriting every
  user-keyed read for a feature with two owner kinds.
- **FK with `ON DELETE SET NULL` plus a name snapshot.** Rejected — decision 2;
  it would also have the database `UPDATE` an append-only table.
- **`FOR UPDATE` on the payer, as `createTeamRows` does.** Works alone, but
  once the payee is checked under any lock a contribution and a payout on the
  same team form a wait cycle through the FK's `KEY SHARE` and deadlock. The
  lock modes in decision 4 remove the cycle rather than ordering around it.
- **One-leg reversal, as the runner panel did.** Rejected — decision 6.
- **Ship payouts now and revise the Terms later**, or **drop payouts**.
  Rejected by the owner in favour of the flag.

## Consequences

- Migration 0027 relaxes `user_id`, adds `team_id`, two partial indexes and the
  check constraint — catalog-only changes plus a scan of a small table. Issue
  #71 also planned a 0027; whichever lands second regenerates, because the
  snapshot files cannot be merged.
- `scripts/verify-treasury.ts` drives `contributeRows`, `payoutRows` and
  `reverseRows` against a real database: 54 checks covering the two legs, the
  replay and the stale form, shortfalls, concurrent spends by one payer,
  twenty contribution-versus-payout races with conservation, payouts to
  non-members and ex-members, two-leg reversal, the check constraint, the
  user-keyed reads, and dissolve.
- Members see who contributed what by first name in the team's treasury
  history; nobody sees ids or emails.
- Open for the owner: the **Terms revision** that releases payouts; whether
  `TREASURY_TRANSFER_MAX_ACER = 10_000` is the right typo guard; and that the
  treasury section shows a member their own balance on the team page while the
  wallet page is still admin-only "in testing" (the `/teams/new` price line
  already does).
