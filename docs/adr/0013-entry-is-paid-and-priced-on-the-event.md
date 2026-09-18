# Entering a race is paid in ACER, priced on the event row, and refunded while registration is open

From October 2026 two nights of the autumn series cost ACER to enter: **100 from
a team's treasury** for a team entry, **5 from a runner's wallet** for an
individual registration. Every other night stays free, and stays free by
default. Paying for it are two raised accruals — **5 ACER on every account at
creation**, and **5 ACER for every race actually run**, past races included.

Decided with the owner on 2026-09-18. The plan is in
`planning/event-entry-fees/README.md`. This ADR is the fourth in the ACER
sequence: 0010 made team creation a spend, 0012 gave a team an account of its
own and reserved `team_entry_fee` for exactly this slice, and this one cashes
that reservation in.

## Decisions

1. **A price is a property of the event, not of the code.** `events` gains
   `team_entry_fee_acer` and `individual_entry_fee_acer` — `integer not null
   default 0`, whole ACER (migration 0028). The alternative was two constants in
   `features/wallet/config.ts` plus a list of the slugs they apply to, and it
   was rejected for the reason ADR 0005 already settled: events are data, and a
   slug list in config puts the lifecycle back into a deploy. `0` is the default
   and means free, so every row that existed when this shipped, and every row
   the admin create form makes afterwards, is unaffected until somebody prices
   it. Pricing the two October nights is an admin edit in the Settings tab.

2. **Whole ACER on the row, minor units at the debit.** The column stores what
   the admin types; the ledger counts what money is counted in everywhere else.
   `features/wallet/entry-fees.ts` is the only place the two meet —
   `teamEntryFeeMinor(event)` and `individualEntryFeeMinor(event)` — and every
   surface that shows a price, every action that pre-checks a balance and every
   transaction that takes the money calls the same one. A night can therefore
   not be rendered as free and charged as paid. A negative or fractional value
   in the column is read as free rather than trusted: charging a negative fee
   would pay people to enter.

3. **The fee charged is the fee at the moment of entry.** It is recorded in the
   ledger row, and re-pricing a night afterwards neither re-charges nor refunds
   anyone. The ledger is append-only and a price change is a fact of its own;
   the alternative — a fee re-derived from the current column whenever anyone
   asks — would make a runner's history change under them when an admin edits a
   form.

4. **The money moves in the same transaction as the thing it pays for.** The
   individual fee joins `createRegistrationWithConsent`, which already writes
   the registration and its consent evidence atomically (ADR 0006); the team fee
   joins `createEntryRows`, which already writes the entry, the member
   registrations and the seats. Neither adds a second write site. The shape is
   `createTeamRows`' (ADR 0010) and the reasoning is the same: lock the payer's
   row, re-read the balance **under that lock**, then write and debit together.
   There is no stored balance to `UPDATE … WHERE balance >= price`, so without
   the lock two entries by the same payer can each read a balance that only
   covers one. A pre-check outside the transaction remains, as a courtesy that
   makes the everyday refusal a message instead of a rollback — it is not what
   makes the rule true.

5. **A team's entry is paid by the team.** The payer is the treasury
   (`{ teamId }`), not the manager's wallet, exactly as ADR 0012 reserved. A
   fallback to the manager's own ACER when the treasury is short was considered
   and rejected: two possible payers for one fact makes the refund ambiguous and
   the history line a lie in one of the two cases. The consequence is
   operational and was accepted knowingly — when this shipped no treasury held
   anything, so the first paid entry needs a contribution or an admin grant
   first, and the refusal names the shortfall and links to the contribute form.

6. **A withdrawal while registration is open is refunded in full; after that it
   is not.** The place a withdrawal releases can still be taken by somebody else
   while the night is `registration_open`, and cannot once it is closed — the
   refund follows what the organiser can still resell. Cancelling an event
   refunds every fee it took, team and individual, because nobody bought
   anything. Removing one member from a team entry refunds nothing: the fee is
   per team per night, not per head, which is also why adding a member later
   costs nothing.

7. **A refund is its own kind, not a `reversal`.** `entry_fee_refund` joins
   `signup_grant` and `individual_entry_fee` in the `WalletTxKind` vocabulary.
   Mechanically a reversal row would do — and the refund does set `reverses_id`,
   so the chain from the credit back to its cause is intact — but the kind is a
   **label on the money screen**, read by the person whose money moved, and
   "correction" tells them an admin fixed a mistake. The debit was right when it
   was made. The doc line reserving `reverses_id` for `reversal` widens to "the
   row this one undoes".

8. **The welcome grant exists to make the guest funnel finishable.** A visitor
   who registers through `registerAsGuest` gets an account before they ever see
   the consent screen, and if the night they came for costs money they must be
   able to pay it. `SIGNUP_GRANT_ACER` (5) is therefore not an arbitrary
   marketing number: it must stay **at or above the highest priced night's
   individual fee**, or that person reaches the last step of a flow they were
   invited into and is refused for want of money nobody told them about. It
   cannot be a compile-time assertion — the fee is a column, the grant is a
   constant — so `scripts/price-autumn-nights.ts` refuses to set a price that
   breaks it, and `scripts/verify-signup-grant.ts` checks the live rows against
   it, instead. It is credited from `databaseHooks.user.create.after`, the one
   site every account-creation path funnels through (email sign-up, the Google
   callback, guest registration), keyed `signup:<userId>`, and it **never
   throws**: a ledger hiccup must not be the reason somebody cannot sign up.

9. **Participation is worth 5, and the past was topped up to it.** The check-in
   accrual goes from 1 to 5. The 2026-08-20 decision not to backfill earning is
   **reversed** for this one grant, by the owner, on the ground that raising the
   reward while leaving everyone who already raced on the old number makes the
   series' own runners the worst-off people on the platform. Past participations
   were **topped up to** 5, not given a second 5, so everyone who has run a race
   holds exactly 5 for it, whenever they ran. In the event the top-up arithmetic
   never fired: the only two `participation_reward` rows that existed are keyed
   on registrations since deleted, so nothing claimed them and the run was 100%
   full credits. Those two accounts still hold 1 ACER for a race whose
   registration is gone; they were reported and left alone. The corollary stands
   either way — raising this number again is not an edit to a constant, it is a
   decision about whether to top up again.

10. **For the backfill only, a participation is a result, not a check-in.**
    `lib/events/participation.ts` defines "races run" as a `checked_in`
    registration (plus a legacy `attended` row), and that definition is correct
    for what it serves. But the desk never worked that way: across four
    completed nights there is exactly **one** `checked_in` row, because
    attendance was recorded by importing the timing system's results, which
    carry a `registration_id` resolved from the (heat, bib) lease. Keyed on the
    canonical predicate the backfill would have credited one person; keyed on
    results it found 144 (user, event) pairs and credited 100 of them (see
    decision 11 for the other 44). That
    wider definition lives **in the script** and did not edit the canonical
    module: the profile's counter and the admin users list read it, and widening
    it there would have restated three surfaces' numbers as a side effect of a
    one-off grant. Result rows that resolve to no account were **reported, not
    guessed** — a name match that is wrong pays a stranger. Thirteen such rows
    remain unpaid on the series nights, Nesteriuk under three spellings among
    them; `warsaw-2026`'s 23 are unlinked by construction and carried by
    `legacy_participations` instead.

11. **A result row is not by itself proof that somebody ran.** The timing export
    lists everyone on the heat sheet, so 45 of the 171 result rows are `dns` —
    for those the row records an **absence**. Forty-four (user, event) pairs are
    `dns` and nothing else, and the owner decided on 2026-09-18 not to credit
    them: the rule is 5 ACER *per race run*, and paying for not turning up
    contradicts it. `dnf` counts as run — they started. The backfill refuses to
    write until the operator picks a side, and skipping is the recoverable
    direction: a pair left out today is credited by a later run under the same
    key, while an ACER paid in error needs a `reversal` row on an append-only
    ledger. The 44 pairs remain creditable with one flag.

## What was actually run, 2026-09-18

- `scripts/backfill-participation-rewards.ts --apply --skip-non-starters`:
  **100 ledger rows, 500 ACER**, across the four mile nights and `warsaw-2026`.
  A second run writes nothing — 100 pairs read `settled`, which is the
  idempotency keys doing it, not a flag.
- `scripts/price-autumn-nights.ts --apply`: `mile-2026-10-01` and
  `mile-2026-10-10` now read team 100 / individual 5. `mile-2026-09-22` stays
  free, and every completed night stays 0/0.
- One individual registration already existed on 01.10 and keeps its free place;
  no team had ever entered any night, so nothing else was grandfathered.

## Consequences

- **Free is still the default and the common case.** Every event row reads 0/0
  until an admin types otherwise; the free path writes no ledger row at all
  rather than a zero-amount one.
- **Registration is no longer unconditionally free**, which four in-code
  comments and ADR 0001 said. ADR 0001's "no payment reference on the
  registration" is now answered — the payment is a ledger row keyed
  `entry_fee:<registrationId>` — but the rest of it stands: this is ACER, not
  Stripe, `pending_registrations` is untouched, and a capped paid flow with card
  payment is still its own future design session.
- **The admin comp path stays free.** `createFreeRegistration`, which an admin
  uses to register a runner by hand, does not charge. Nobody ticked a consent
  box there either.
- **A refusal is a number, not a shrug.** Both paths refuse by naming what is
  needed and what is held, and linking to the page that fixes it — the wallet
  top-up for a runner, the contribute form for a treasury. A paid button that
  fails at submit with "insufficient funds" is the failure the whole price-on-
  the-summary arrangement exists to prevent.
- **The Terms of Use describe a new spend.** Team creation as a spend is covered
  (ADR 0010); entry fees and the withdrawal refund are not, and go to the same
  counsel review that still gates treasury payouts behind
  `TREASURY_PAYOUTS_ENABLED`.
