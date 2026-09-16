# Founding a team is paid in ACER, debited inside the team's own transaction

From September 2026 creating a team costs **100 ACER**
(`TEAM_CREATION_PRICE_ACER`), taken from the creator's wallet at the moment the
team is created. The wallet is ours — an append-only ledger we write
(`wallet_transactions`, PRD #45) — so there is no payment provider in this path
and no moment where the money and the team disagree: the team row, the debit and
the manager's membership are **one transaction** or none of them happened.
Entering an event as a team (PRD #64) and everything roster-side stay free; the
fee is charged once, at formation.

The owner's word for the currency is "aces". In code, copy and UI it is always
**ACER**, the wallet asset: `ACE` is a race role (ADR 0009's composition terms),
and one word for two things in a money path is how a refund goes to the wrong
place.

## Decisions

1. **Synchronous debit, no pending state.** `createTeamRows`
   (`src/features/teams/creation.ts`) inserts `user_teams`, appends the
   `team_creation` ledger row and inserts the manager's `user_team_members` row
   in a single `db.transaction`. A team with no manager on its roster is
   unreachable and uncountable; a debit for a team a unique violation rolled
   back is money taken for nothing. It is also why `name_taken` and
   `already_in_category` are still left to surface as 23505s from inside the
   transaction — there they undo the payment for free, with no refund path to
   write.

2. **The creator's `users` row is the mutex.** There is no stored balance to
   `UPDATE … WHERE balance >= price`; the balance is `SUM(amount_minor)` over
   completed rows. Two creates by one person — a double-click, two tabs — would
   each read the same sum and both pass. Inside the transaction we take
   `select id from users where id = $userId for update` and only then read
   `getAcerBalance(userId, tx)`. The second caller waits on the lock, re-reads a
   balance that now includes the first debit, and throws
   `InsufficientAcerError`, which the action maps to the ordinary
   `insufficient_balance` refusal. The pre-check outside the transaction is a
   courtesy that makes the everyday case a sentence instead of a rollback; the
   lock is what makes the pre-check *true*.

3. **The ledger keeps its single writer.** `recordWalletTransaction` grew an
   optional `tx: DbExecutor` parameter (the `executor(tx)` idiom team check-in
   already uses) rather than a second insert site. Composing a spend into a
   caller's transaction goes through that parameter and nowhere else, so the
   "one writer, append-only" rule survives the first path that had to write from
   inside somebody else's transaction.

4. **`team_creation` is a new `WalletTxKind`, and that is a TypeScript change.**
   `kind`, `asset` and `status` are `text().$type<>()` columns, so adding a kind
   needs no migration — this whole PRD ships without one. The row is
   `amount_minor = -acerToMinor(100)`, `reference = team:<slug>` (the handle
   that answers "what was this 100 for", rendered as a link to the team in both
   the runner's history and the admin ledger) and
   `idempotency_key = team_creation:<teamId>`. The team id is minted inside the
   transaction, so the key is unique by construction and the insert is plain in
   practice; the key exists so that no retry of this exact creation can ever
   charge twice.

5. **No refund on dissolve.** Dissolving a team does not return the fee, and
   re-creating charges again. A refund would be a second money rule (who is
   owed, for how long, at which price) for a case nobody has had yet. The escape
   hatch already exists and is enough: an admin appends a `reversal` of the
   `team_creation` row through `reverseWalletTransaction`, which leaves both rows
   visible and netting to zero — an explainable correction rather than a silent
   credit. Existing teams are untouched; no debits were backfilled, because that
   would be inventing payments that never happened.

6. **Bulk admin grants credit only, keyed by batch.** `creditAcerBulk`
   (`src/features/admin/wallet-grant.ts`) credits whole ACER to every ticked
   account on `/admin/users` in one transaction, with one mandatory reason in
   every row's `memo` and the acting admin in `created_by`. A bulk *debit* is a
   mistake magnet, so debits stay on the per-user panel where the admin is
   looking at one ledger. Every refusal — no selection, bad amount, missing
   reason, a selected id that no longer exists — happens **before the first
   insert**: a grant that credited half a list is worse than one that credited
   none, because the admin cannot tell which half. Rows carry
   `reference = grant:<batchId>` (the handle that finds every row of one grant)
   and `idempotency_key = grant:<batchId>:<userId>`.

7. **The bulk form is keyed; the per-user form stays un-keyed.** The batch id is
   minted when the users list renders, so pressing the button twice, or a
   browser retrying the post, appends nothing the second time and reports "that
   grant is already recorded", while a *fresh render* mints a fresh batch and a
   deliberate second grant to the same people still works. The per-user
   credit/debit form deliberately carries no key, because two identical
   adjustments typed on purpose are two real adjustments and the ledger must
   hold both. That is a refinement of the same stance, not a reversal of it: one
   considered entry is repeatable, one button press is not.

8. **`isUniqueViolation` walks `cause`.** Drizzle wraps a failed query in a
   `DrizzleQueryError` whose own `code` is undefined, so reading `code` off the
   top-level error never matched and a `name_taken` race came back as a 500
   instead of a refusal. The fix walks the `cause` chain, the way
   `creditAcerPurchase` already did. `isInsufficientAcer` walks it for the same
   reason: missing the sentinel means a 500 in place of a refusal, on the path
   where the refusal is the common case.

9. **Reuse `admin_credit` for grants.** A separate `bulk_credit` kind would
   split "a human credited this account" across two names for one fact, and
   would need its own label, its own reversal path and its own row in every
   report. The batch reference already tells the two apart when anyone needs to.

## Considered options

- **A stored `balance` column** updated alongside every row, so the spend is
  `UPDATE … WHERE balance >= price` and the race is the database's problem.
  Rejected: the schema comment on `wallet_transactions` already argues the
  ledger is the truth and a cached total is a second truth to reconcile, and
  this plan is not the place to reopen it. The `for update` on `users` costs one
  lock on a path that runs a handful of times a day.

- **`pg_advisory_xact_lock(hashtext(userId))`** as the per-user mutex. It works,
  and it does not touch a row the transaction is not otherwise interested in.
  Rejected because the codebase has no advisory-lock precedent, hash collisions
  between two users are silent when they happen, and the `users` row is a
  perfectly good mutex that reads like the `for update` idiom already used on
  team, invitation and join-request rows.

- **Stripe Checkout with a 100 %-off launch coupon**, the design in
  [`planning/team-creation-payment/superseded-stripe-coupon.md`](../../planning/team-creation-payment/superseded-stripe-coupon.md):
  a 50 PLN fee, a `pending_teams` table, a webhook and a return page racing to
  promote the payload into a real team, and `TEAM_CREATION_COUPON_ID` as the
  switch that turns the money on. It was superseded because the wallet arrived
  first: charging our own credit makes the payment synchronous, which deletes
  the entire two-phase apparatus — the pending table, its expiry sweep, the
  `checkout.session.expired` branch, the "name taken while the creator was at
  Stripe" refund hole, and the migration all of it needed. Three of its
  decisions carried over unchanged and are decisions here too: **only
  `createTeam` is paid** (entry stays free), **no refund on dissolve**, and **no
  backfill onto teams created while creation was free**. Its unanswered
  questions about VAT, invoices and terms acceptance at checkout go back in the
  drawer with it — they belong to the ACER *purchase* flow (PRD #49), which is
  where real money still enters.

- **Bulk debit as well as bulk credit**, for symmetry with the per-user panel.
  Rejected outright — see decision 6.

## Consequences

- With ACER purchases off (`ACER_PURCHASE_ENABLED` unset) and accruals worth 1
  ACER per check-in, 100 ACER is unreachable without an admin grant. **The bulk
  grant is therefore the approval step for founding a team**, and that is why it
  shipped before the price was announced. It is deliberate, and it is a policy
  decision living in an admin's hands rather than in a feature flag.

- `/teams/new` shows the price, the balance and, when short, the shortfall and a
  link to `/wallet` with the submit disabled. All of it is **display only** — the
  action re-reads the constant and the balance under the lock, so a price
  changed by a deploy while a form is open charges the new price, and a form
  posted by hand is refused by the same rule as one clicked.

- The wallet link may only promise a top-up when `isAcerPurchaseEnabled()`,
  resolved server-side and passed as a prop; the flag stays non-`NEXT_PUBLIC_`,
  because a flag the browser can read is a flag the browser can be wrong about.

- `creation.ts` and `wallet-grant.ts` are plain modules, not `"use server"`, and
  hold no session: the authorization and the redirect live in the action, the
  act lives in the module, and a verification script can drive a real paid
  creation or a real grant against the database without forging a session. For a
  money path that is the difference between verifying the ledger arithmetic and
  verifying a screenshot.

- Open questions the owner has not yet answered: whether the **1 ACER = 1 USD
  peg copy** should be revisited before purchases go live (a 100 ACER fee reads
  as a 100 USD fee to anyone who buys ACER to pay it); whether an admin should
  get a **fee waiver / free creation path** (there is no admin-creates-a-team
  path today, so there is no bypass to design yet); and whether the launch grant
  needs **selection across pages** ("credit everyone matching this filter") —
  selection is per page today and the bar says so.
