# Task 15 — Wallet: product spec + client questions (NO code)

Size: S (spec only). Dependencies: none. ⚠️ Implementation is intentionally NOT part of this task — schema/Stripe work starts only after the client answers. Follow-up build tasks get split out then.

## Background
The client asked for: balances for ACER / ACE(PL) / ACEG, ACER accrual history, Stripe + Blink integration, ACER purchase (deposit/withdraw). Nothing exists in the codebase — zero hits for wallet/ACER/ACEG/balance/ledger/blink; Stripe integration is only the frozen legacy 50 PLN team checkout (`src/lib/stripe/index.ts`, webhook `src/app/api/stripe/webhook/route.ts` — comment at :30 notes individual events are free). The broader token model is specced in `planning/ТЗ Личный Кабинет Ace Battle Sport v2.0.md` §2.6 (balances, fiat purchase, conversions, staking, income categories incl. referral income §2.6.3, transaction-history attributes §2.6.4).

## Deliverable
A short PRD-style spec `planning/wallet-prd.md` containing:

1. **Recommended architecture** (argue for it): off-chain append-only ledger first — `wallet_transactions` (userId, asset enum `ACER|ACE_PL|ACEG`, signed amount, kind enum, reference, createdAt), balances derived by SUM, no balance column to drift; on-chain (Polygon per ТЗ §3.5) deferred to a later export. Additive migration, legacy tables untouched — repo policy.
2. **Phase plan**: A — ledger + accrual hooks (check-in participation, referral events per ТЗ 2.6.3) + cabinet Wallet page (balances + history per ТЗ 2.6.4) + admin manual credit/debit with audit (~1–1.5 wk). B — buy ACER via Stripe: new checkout with `metadata.kind = "acer_purchase"` branched in the existing webhook (same isolation pattern the event-registration plan used — legacy path untouched), idempotent crediting by session id (~0.5–1 wk). C — Blink, conversions, staking, DAO: out of scope, separate PRDs.
3. **Questions for the client** (the blockers — put them first):
   - ACER↔PLN price; accrual amounts per source (participation, prizes, referral sign-up/ticket income); ACE(PL)↔ACER↔ACEG conversion rules if any in v1.
   - "Blink" — which provider exactly (Blink the Bitcoin Lightning API? something else?), and is it launch-critical or is Stripe-first fine?
   - Withdrawals ("вывод") in v1? Recommendation: no — purchase-only v1.
   - Legal: selling ACER for fiat may trigger e-money/MiCA obligations in PL/EU — who confirms the legal wrapper?
   - On-chain requirement now, or is the off-chain ledger acceptable for v1 with export later?
4. **Explicit non-goals for v1**: staking, DAO voting, conversions, Web3 wallet linking, withdrawals.

## Acceptance
- `planning/wallet-prd.md` exists with the four sections above, concise enough to send to the client as-is (Russian translation of the questions block included, since the client communicates in Russian).
- No code, no migrations, no dependencies added.
