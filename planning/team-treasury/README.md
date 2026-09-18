# Plan — team treasury: a team-owned ACER account on the shared ledger

Decided with the owner on 2026-09-17. Written up as
[ADR 0012 — a team's treasury is an owner on the shared ledger](../../docs/adr/0012-team-treasury-on-the-shared-ledger.md).

The owner's word for the currency is "aces"; in code, copy and UI it is **ACER**
(ADR 0010). The team's account is the **treasury**; money in is a **contribution**,
money out to a member is a **payout**, money from an admin is a **grant**. Not
"top-up" — CONTEXT.md reserves that for a purchase.

## Goal

A team has its own ACER account that the manager controls. Members and the manager pay
into it from their personal wallets; the manager can pay out of it to roster members;
admins can credit it with a reason; future slices debit it for event entry fees and
credit it with rewards.

## Decisions

| Question | Decision |
|---|---|
| Event entry fee | **Not now.** `team_entry_fee` is a reserved `WalletTxKind`; `enterTeam` stays free (ADR 0010). The fee slice will debit the treasury inside `createEntryRows`' transaction the way `createTeamRows` debits a wallet. |
| Rewards into the treasury | **Admin grant only** in this scope. Prize / participation rewards are later callers of the same credit path. |
| Money leaving the treasury | **Manager pays out to any current roster member**; admin debit and reversal. |
| Dissolve | **Forfeited**; rows stay. No FK on `team_id` is what makes that possible. |
| Terms of Use | The Terms say ACER "cannot be moved to another user". **Payouts ship behind `TREASURY_PAYOUTS_ENABLED=1`** until the clause is revised with counsel. Contributions and grants are not gated. |
| Ledger shape | One ledger, exclusive owner per row (`user_id` xor `team_id`, check constraint). |
| Transfer keying | Client-minted uuid per attempt, `transfer:<id>:out` / `:in`; replay looked up before the balance. |
| Locks | Payer `FOR NO KEY UPDATE`, payee `FOR KEY SHARE`, roster seat `FOR KEY SHARE`. No cycle between a contribution and a payout. |
| Reversal | Both legs of a transfer, one transaction, shared by the runner and treasury panels. |
| Bounds | Whole ACER, `TREASURY_TRANSFER_MIN_ACER = 1`, `TREASURY_TRANSFER_MAX_ACER = 10_000` (typo guard). |

## What exists (read before touching anything)

| Piece | Where |
|---|---|
| Ledger, owner-aware | `src/db/schema/wallet.ts` (`WalletOwner`), `src/features/wallet/data.ts` (`ownerOf`, `ownerWhere`, `getTeamAcerBalance`, `getWalletTransactionByKey`) |
| Migration | `src/db/migrations/0027_blushing_orphan.sql` |
| Sentinels | `src/features/wallet/errors.ts` (`InsufficientAcerError` moved here; `creation.ts` re-exports) |
| Transfer primitive + payout flag | `src/features/wallet/transfers.ts` |
| Team side of a transfer | `src/features/teams/treasury.ts` (`contributeRows`, `payoutRows`) |
| Actions | `src/features/teams/actions/treasury.ts`; guard `requireTeamMember` in `guards.ts`; reasons in `config.ts`; schemas in `schemas.ts` |
| Team page section + islands | `src/features/teams/components/team-treasury.tsx`, `treasury-contribute-form.tsx`, `treasury-payout-form.tsx`; wired in `src/app/[locale]/teams/[slug]/page.tsx` |
| Full history | `src/app/[locale]/teams/[slug]/treasury/page.tsx` (`force-dynamic`, roster or admin `view`) |
| Dissolve warning | `roster-controls.tsx` (`treasuryMinor` prop) |
| Admin | `src/features/admin/treasury-actions.ts`, `wallet-form.ts` (shared parsing), `wallet-reverse.ts` (two-leg reversal), `components/wallet-panel.tsx` (`subject` prop), `/admin/teams/[slug]` Treasury card, `/admin/teams` Treasury column |
| Verification | `scripts/verify-treasury.ts` — 54 checks against a real database |
| Copy | `teams.treasury.*`, `teams.reasons.{treasury_insufficient,not_a_member,invalid_amount,stale_form,payouts_disabled}`, `teams.roster.dissolveMessageTreasury`, `wallet.kinds.{treasury_contribution,treasury_payout,team_entry_fee}`, revised `wallet.purchase.note` / `wallet.purchase.stripe.description` ×3 |

## Slices

| # | Slice | Status |
|---|---|---|
| 1 | Schema + data: migration, `WalletOwner`, owner-aware reads, kinds + labels ×3, sentinels module | done |
| 2 | Primitive + actions: `transfers.ts`, `teams/treasury.ts`, `actions/treasury.ts`, `requireTeamMember`, reasons ×3, bounds + flag, `scripts/verify-treasury.ts` | done |
| 3 | Public UI: treasury section + islands, `/teams/[slug]/treasury`, dissolve warning, copy ×3 | done |
| 4 | Admin: treasury card + `treasury-actions.ts`, two-leg reversal on both panels, treasury column | done |
| 5 | ADR 0012, CONTEXT.md, this README | done |

## Release conditions

- **Payouts**: revise the non-transferability clause in the Terms of Use (pl/en/ua, bump
  the legal manifest), then set `TREASURY_PAYOUTS_ENABLED=1`. Until then the payout form
  is absent and the action refuses `payouts_disabled`.
- **Migration numbering**: issue #71 also plans a 0027. Whichever lands second regenerates
  its migration; the snapshot files cannot be merged textually.

## Verification

```bash
npm run typecheck && npm run lint && npm run build
# against a database with migration 0027 applied (a throwaway Postgres 16 is enough):
ALLOW_FIXTURES=1 DATABASE_URL=… npx tsx scripts/verify-treasury.ts
```

HTTP, all three locales: `/teams/<slug>` as a member shows the treasury balance and the
pay-in form (`data-team-treasury`, `data-treasury-form="contribute"`); as the manager
with the flag on also the payout form; as a stranger no treasury section;
`/teams/<slug>/treasury` renders for a member and 404s for a stranger;
`/admin/teams/<slug>` shows the Treasury card and an adjustment with a reason lands on
the team ledger; `/admin/teams` shows the Treasury column.

## Open questions for the owner

1. The Terms revision wording (counsel).
2. Members see who contributed what (first names) in the team history — confirm.
3. The treasury section shows a member their own balance while `/wallet` is still
   admin-only "in testing" — confirm (the `/teams/new` price line already does).
4. `TREASURY_TRANSFER_MAX_ACER = 10_000` — adjust if wrong.
