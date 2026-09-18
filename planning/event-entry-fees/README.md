# Plan — paid event entry, and the ACER that pays for it

Decided with the owner on 2026-09-18. Four changes that only make sense together:
entry stops being free on two October nights, and the two accruals that put ACER
in a wallet are raised so people have it to spend.

The owner's word for the currency is "aces"; in code, copy and UI it is **ACER**
(ADR 0010). Money into a team's account is a **contribution**, money out of it
for a race is an **entry fee** (ADR 0012).

## Goal

| # | Change | Amount |
|---|---|---|
| A | Every new account is credited on creation | **5 ACER**, once per account |
| B | Every race actually run is worth | **5 ACER** (was 1), past races included |
| C | Registering alone for `mile-2026-10-01` / `mile-2026-10-10` | **−5 ACER** from the runner's wallet |
| D | Entering a team into those two nights | **−100 ACER** from the **team treasury** |

A first-timer's grant (5) exactly covers one individual entry (5). That is the
intended funnel and it is a constraint, not a coincidence: if the individual fee
ever exceeds the signup grant, a guest can no longer finish the flow they were
shown. See *Release conditions*.

## Decisions taken with the owner (2026-09-18)

| Question | Decision |
|---|---|
| Which nights are paid | `mile-2026-10-01` and `mile-2026-10-10` — the rows seeded by `seed-mixed-nights-autumn-2026.ts`. "11th" was a slip; the Saturday night is the 10th. `mile-2026-09-22` stays free. |
| Participation reward | `PARTICIPATION_REWARD_ACER` **1 → 5**. Past participations are **topped up to 5**, not given a second 5. Everybody ends at exactly 5 per race run. |
| Who pays the team fee | The **treasury only** — what ADR 0012 reserved (`team_entry_fee` debits the treasury inside `createEntryRows`' transaction, the way `createTeamRows` debits a wallet). No fallback to the manager's own wallet: two payers for one fact makes the refund ambiguous. |
| Refunds | **Withdrawal while the event is `registration_open` refunds in full.** After registration closes the fee is forfeited. **Cancelling an event refunds every fee it took**, team and individual. |

## Decisions taken here (flag if you disagree)

| Question | Decision | Why |
|---|---|---|
| Where the price lives | Two new columns on `events`: `team_entry_fee_acer`, `individual_entry_fee_acer`, `integer not null default 0`, whole ACER. | Events are data, not config (ADR 0005). Hardcoding two slugs in `wallet/config.ts` would put the lifecycle back in a deploy. `0` = free, so every existing row and every future one the admin form creates is unchanged until someone prices it. |
| Price changes | The fee charged is the fee **at the moment of entry**, recorded in the ledger row. Re-pricing a night never retro-charges or retro-refunds. | Append-only ledger; a price is an event of its own. |
| New ledger kinds | `signup_grant`, `individual_entry_fee`, `entry_fee_refund`. `team_entry_fee` already exists, reserved and unwritten — this is what writes it. | The history line is read by the person whose money moved. `reversal` would read to them as "an admin fixed a mistake", which a withdrawal is not. The refund row still sets `reversesId` to the fee row, so the audit chain is intact — the doc line on `reversesId` ("set only on `kind = reversal`") widens to "set on a row that undoes another". |
| Admin-registered runners | `createFreeRegistration` (the admin "register this user" action, `users-actions.ts:118`) **stays free**. | It is the comp path. Nobody ticked anything there and nobody is charged for it either. |
| Adding a member after entry | `addEntryMember` is **free**. | The fee is per team per night, not per head. |
| Legacy attendees | `warsaw-2026` runners with `legacy_participations.attended = true` **are** backfilled. | They participated. This is the one part of B the owner has not seen a number for — the script prints the series/legacy split before it writes. |
| Existing accounts and the signup grant | **Not granted.** A separate opt-in script is drafted but unscheduled. | The owner said "when a new user registers". Backfilling ~N accounts with 5 ACER each is a different decision with a different bill. |

## What exists (read before touching anything)

| Piece | Where |
|---|---|
| Ledger, single writer, owner-aware | `src/db/schema/wallet.ts`, `src/features/wallet/data.ts` (`recordWalletTransaction`, `getAcerBalance`, `getTeamAcerBalance`, `getWalletTransactionByKey`) |
| Amounts and conversion | `src/features/wallet/config.ts` (`PARTICIPATION_REWARD_ACER`, `acerToMinor`) |
| The two automatic accruals | `src/features/wallet/accruals.ts` — hangs off `checkInWithBib` / `checkInWithoutBib` in `features/admin/events-data.ts` |
| A spend inside another write's transaction | `src/features/teams/creation.ts` (`createTeamRows`: lock the payer, re-read the balance under it, insert, debit) |
| Two-leg transfers, lock modes and replay | `src/features/wallet/transfers.ts` |
| Shortfall sentinel | `src/features/wallet/errors.ts` (`InsufficientAcerError`, `isInsufficientAcer`) |
| Individual registration write | `src/features/event-registration/data.ts` (`createRegistrationWithConsent`) — the transaction the fee joins |
| Individual registration gate | `src/features/event-registration/actions.ts` (`registerForEvent`, `registerAsGuest`) |
| Team entry write | `src/features/teams/entries.ts` (`createEntryRows`, `withdrawEntryRows`) |
| Team entry gate | `src/features/teams/actions/entries.ts` (`enterTeam`, `withdrawEntry`) |
| Account creation hook | `src/lib/auth/better-auth.ts` → `databaseHooks.user.create.after` (referral attribution already rides it) |
| "Participated" — the one definition | `src/lib/events/participation.ts` (`RAN_SERIES_RACE`, `RAN_LEGACY_RACE`) — the backfill restates neither |
| Event row + admin form | `src/db/schema/events.ts`, `features/admin/event-schemas.ts`, `event-actions.ts`, `components/event-form.tsx`, `lib/events/store.ts` (`EventSummary`) |
| Existing refusal key for an empty treasury | `teams.reasons.treasury_insufficient` ×3 (`config.ts:88`) — reused, not re-invented |

## Slices

| # | Slice | Contents |
|---|---|---|
| 1 | **Vocabulary + price column** | Migration `0028`: two fee columns on `events`. `WalletTxKind` += `signup_grant`, `individual_entry_fee`, `entry_fee_refund` + labels ×3. `SIGNUP_GRANT_ACER = 5`; `PARTICIPATION_REWARD_ACER` 1 → 5. Fees onto `EventSummary` in `store.ts`; zod + form fields + create/update wiring in the admin Settings tab. |
| 2 | **Signup grant** | `creditSignupGrant(userId)` in `accruals.ts` — key `signup:<userId>`, never throws (an uncredited grant must not fail account creation, same `attempt` wrapper as the check-in rewards). Called from the `user.create.after` hook beside `applyReferralAttribution`, so email sign-up, Google OAuth and `registerAsGuest` all get it from one site. |
| 3 | **Individual fee** | `createRegistrationWithConsent` takes `feeMinor` (positive; `0` skips): lock the runner's `users` row `FOR NO KEY UPDATE`, re-read `getAcerBalance(userId, tx)`, throw `InsufficientAcerError` if short, then registration → consent rows → debit, key `entry_fee:<registrationId>`. `registerForEvent` gains a pre-check and a new `insufficient_acer` refusal carrying the shortfall. Price + balance + a top-up link on the register CTA and the confirm screen; copy ×3. |
| 4 | **Team fee** | `createEntryRows` takes `feeMinor`: lock the `user_teams` row `FOR NO KEY UPDATE`, re-read `getTeamAcerBalance(teamId, tx)`, refuse, then entry → registrations → seats → debit, key `team_entry_fee:<entryId>`. `enterTeam` returns `treasury_insufficient` with the shortfall (new `shortfallMinor` on `EntryFailure`, beside `missing` / `memberName`). Fee + treasury balance + a contribute link on the entry surface; copy ×3. |
| 5 | **Refunds** | `withdrawEntryRows` credits the treasury back inside its own transaction when the event is `registration_open`: find the fee row by key, write `entry_fee_refund` keyed `entry_fee_refund:<entryId>` with `reversesId` set. `refundEventFees(eventSlug)` on the admin transition to `cancelled` — every team entry and every individual registration for that night, each idempotent by its own key. |
| 6 | **Backfill + pricing** | `scripts/backfill-participation-rewards.ts`: **dry-run by default, `--apply` writes.** Series rows via `RAN_SERIES_RACE`, legacy via `RAN_LEGACY_RACE`. Existing `participation:<id>` row → top up the difference under `participation_topup:<id>`; no row → the full 5 under the canonical `participation:<id>`; legacy → 5 under `participation_legacy:<userId>:<eventSlug>`. Prints users / events / rows / total ACER and the series-vs-legacy split before writing. Then `scripts/price-autumn-nights.ts` — idempotent, sets 100/5 on the two October rows only. |
| 7 | **Docs** | ADR 0013 (entry is paid, priced on the event row, refunded while open). Amend ADR 0001 — its "no payment reference on the registration" is now answered by a ledger row keyed by registration id; `pending_registrations` is still untouched and still the Stripe seam. Update the `accruals.ts` header (the 2026-08-20 "no backfill" decision is reversed) and the `event_registrations` / `createFreeRegistration` "all registrations are free" comments. CONTEXT.md terms. |

Slices 3 and 4 are independent of each other and both depend on 1. Slice 6 depends on
everything, because pricing the rows is what actually switches charging on.

## Pre-flight, before slice 6 prices anything

1. **Count what is already entered.** Any team entry or individual registration already
   held for `mile-2026-10-01` / `mile-2026-10-10` is **not** charged retroactively — the
   fee is taken at entry and those entries already happened. Get the number first so
   nobody is surprised by a half-paid start list.
2. **The treasuries are empty.** Treasury shipped 2026-09-17; the first paid night is
   2026-10-01. A manager cannot enter until 100 ACER is in the team account, and the
   only ways in are a member contribution (from personal ACER — purchases, rewards) or
   an admin grant. Decide the operational answer before pricing, not after a manager
   hits the refusal.
3. **Terms of Use.** ACER spent on team creation is covered (ADR 0010). Entry fees and
   the withdrawal refund are new spend terms; payouts are still behind
   `TREASURY_PAYOUTS_ENABLED` pending counsel, and this belongs in the same review.

## Release conditions

- `SIGNUP_GRANT_ACER >= individual_entry_fee_acer` on every priced night. It cannot be a
  compile-time assertion once the price is a column, so it is an operational rule and a
  check in the verification script: a guest who signs up must be able to finish.
- A double-submitted register or enter charges **once** — proven by key, not by a guard
  someone remembered.
- An interrupted entry writes **nothing**: no entry without its debit, no debit without
  its entry.
- Withdraw-while-open returns exactly what was taken, and withdrawing twice returns it
  once.
- The backfill run leaves **every** participant at exactly 5 ACER per race run, and a
  second run of it writes nothing.

## Verification

`scripts/verify-entry-fees.ts`, in the shape of `verify-treasury.ts` — a real database,
fixture ids, deletes scoped to what it created (there is no Neon branch; the live DB is
what a round trip hits). It must cover: the arithmetic of both fees, both shortfall
refusals, double submit on each path, the withdrawal refund and its idempotency, the
cancellation sweep, the signup grant firing once per account, and the release condition
above. `verify-wallet-accruals.ts` extends to the new participation amount.
