# Wallet & Financial Assets — PRD v2 (decisions locked)

Scope: the ЛК "Wallet" module from `planning/ТЗ Личный Кабинет Ace Battle Sport v2.0.md` §2.6
(balances ACE[cc] / ACER / ACEG, ACER accrual, fiat purchase, transaction history).

Status: **spec + client decisions — ready to build.** All ten blocker questions from v1 were
answered in the 2026-08-20 grilling session; the answers are recorded in §1. The codebase today
has zero wallet/token/ledger code; the only Stripe integration is the frozen legacy 50 PLN team
checkout (`src/lib/stripe/index.ts`, `src/app/api/stripe/webhook/route.ts:30`) — individual event
registration is free and uncapped (`docs/adr/0001-defer-paid-capped-registration-seam.md`).

---

## 1. Decisions (answers to the v1 blocker questions)

| # | Question (v1) | Decision |
|---|---|---|
| 1 | ACER price & packs | **1 ACER = 1 USD, always** (internal peg). Stripe checkout charges **USD** — exactly $N for N ACER, no exchange-rate logic. Purchase UX: **preset packs (10 / 25 / 50 / 100 ACER) + a custom-amount field**; custom accepts **whole ACER only, min 5, max 500** per transaction. |
| 2 | Accrual amounts | **1 ACER** to the runner per event check-in. **1 ACER** to the referrer, **once per referred person**, the first time that person checks in to any event (sign-up alone pays nothing — not farmable without physical attendance). Podium prizes, ticket-referral %, sponsor rewards: **deferred** (sponsor rewards payable via admin manual credit meanwhile). Amounts live in one config module, changeable without a migration. |
| 3 | Token precision | **2 decimals, stored as integer cents** (minor units) in the ledger. Purchases are whole-ACER only; fractional amounts reserved for future percentage-based income. |
| 4 | Conversions / other tokens | **No conversions in v1.** ACE(PL) (the ТЗ's ACE[cc]) and ACEG are **displayed, read-only, 0** for everyone. No issuance rule; admin manual credit remains physically possible via the ledger but is not a product feature. |
| 5 | "Blink" | Confirmed as **Blink, the Bitcoin Lightning API** — **deferred to its own phase**. Stripe only in this slice. The `purchase` kind + idempotency-key design already accommodates a second payment source. |
| 6 | Withdrawals | **Not built and not mentioned anywhere in the UI.** Future shape agreed: withdrawal/payout will apply to **earned/prize ACER only**; **purchased ACER stays spend-only forever** (that split is what keeps a future payout feature out of money-transmission territory). The ledger `kind` column preserves the earned-vs-purchased distinction at zero extra cost. |
| 7 | Legal wrapper | ACER is presented everywhere user- and Stripe-facing as **prepaid platform credit** — non-withdrawable, non-transferable, usable only within the platform, no interest. **Zero crypto/stablecoin wording** in checkout, wallet UI, or terms. This is the PSD2 limited-network / non-e-money framing. |
| 8 | On-chain | **Off-chain append-only ledger in v1** (§2). On-chain export is a documented later path, not a v1 concern. |
| 9 | Paid tickets | Stay free (ADR 0001); referral ticket income stays 0. See the consumer-protection note in §4-L. |
| 10 | Manual adjustments | **Full-access admins (`admin` role) only, single approver.** Mandatory reason, `createdBy` audit on every row, corrections via offsetting `reversal` rows — never UPDATE/DELETE. |

**Backfill: none.** Earning starts at launch; past check-ins and past referrals from the Aug
series earn nothing retroactively. The ledger starts empty for everyone.

---

## 2. Architecture — off-chain append-only ledger

**One append-only ledger table, balances derived by `SUM`. No balance column.**

Why:

- **A balance column drifts.** Two writers (a check-in accrual and a Stripe webhook retry) racing on
  `balance = balance + x` silently loses money, and nothing in the DB tells you it happened. A ledger
  makes every balance reproducible from its causes, and reconciliation is a single query.
- **The ТЗ already asks for the ledger.** §2.6.4 lists the required transaction attributes —
  timestamp, TxID, asset, signed amount, purpose, status. That *is* the row shape. A balance table
  would be a denormalisation of data we must store anyway.
- **Append-only makes finance auditable.** Corrections are new `reversal` rows, never `UPDATE`/`DELETE`,
  so an admin mistake stays visible instead of being erased.
- **It is the on-chain export path, not a detour.** A signed-amount journal keyed by user is exactly
  what a later Polygon mint/airdrop script reads.
- **It fits repo policy**: one additive migration, no legacy table touched.

Balances are `SELECT asset, SUM(amount_minor) FROM wallet_transactions WHERE user_id = $1 AND status = 'completed' GROUP BY asset`.
With an index on `(user_id, asset)` this stays trivial at our volumes (hundreds of users, tens of rows
each). If it ever isn't, the fix is a cached projection *behind the same read function* — not a schema change.

### Schema — `src/db/schema/wallet.ts` (new file, exported from `src/db/schema/index.ts`)

```ts
/** The three ЛК assets (ТЗ 2.6.1). ACE_PL is the ТЗ's ACE[cc] localised token. */
export type WalletAsset = "ACER" | "ACE_PL" | "ACEG";
export const WALLET_ASSETS: readonly WalletAsset[] = ["ACER", "ACE_PL", "ACEG"];

/** Why a row exists. Maps 1:1 onto ТЗ 2.6.3 income sources + purchase + admin correction. */
export type WalletTxKind =
  | "participation_reward"  // 2.6.3.2 — 1 ACER per check-in
  | "prize_reward"          // 2.6.3.2 Prize Pool Rewards (deferred; kind reserved)
  | "referral_signup"       // 2.6.3.1 — 1 ACER at referred person's first check-in
  | "referral_ticket"       // 2.6.3.1 Ticket Sales Income (0 until paid entry exists)
  | "referral_sponsor"      // 2.6.3.1 Sponsor Attraction Income (admin-entered)
  | "purchase"              // 2.6.2.1 fiat -> ACER (phase B). NEVER withdrawable (§1 Q6)
  | "admin_credit"
  | "admin_debit"
  | "reversal";             // correction of an earlier row

/** ТЗ 2.6.4.2 status vocabulary. Only `completed` rows count toward a balance. */
export type WalletTxStatus = "completed" | "pending" | "failed";

export const walletTransactions = pgTable(
  "wallet_transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),          // the TxID shown in the ЛК
    userId: text("user_id").notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    asset: text("asset").$type<WalletAsset>().notNull(),
    /** Signed integer cents (+ in / − out). 1 ACER = 100 minor = 1 USD. */
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
    kind: text("kind").$type<WalletTxKind>().notNull(),
    status: text("status").$type<WalletTxStatus>().default("completed").notNull(),
    /**
     * What caused it, for the history line and for drill-down:
     * "event:mile-2026-08-15" | "registration:<uuid>" | "stripe:cs_..." | "user:<id>".
     */
    reference: text("reference"),
    /** Free-text purpose ("Назначение платежа", ТЗ 2.6.4.2) + admin note. */
    memo: text("memo"),
    /** Admin actor for manual rows; null for system accruals. Audit trail. */
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    /** The row this one reverses; only set on `kind = "reversal"`. */
    reversesId: uuid("reverses_id").references((): AnyPgColumn => walletTransactions.id),
    /**
     * Natural key of the causing fact — "participation:<registrationId>",
     * "referral_checkin:<referredUserId>", "stripe:<sessionId>". The unique index
     * makes every accrual and every webhook retry idempotent by construction.
     * Null for manual admin entries (deliberately repeatable).
     */
    idempotencyKey: text("idempotency_key"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("wallet_tx_idempotency_uq").on(table.idempotencyKey)
      .where(sql`${table.idempotencyKey} is not null`),
    index("wallet_tx_user_asset_idx").on(table.userId, table.asset),
    index("wallet_tx_user_created_idx").on(table.userId, table.createdAt),
  ],
);
```

Repo conventions this follows (all already established, see the cited files):

- **`text` + `$type<>` instead of `pgEnum`** for `asset` / `kind` / `status`. `ALTER TYPE … ADD VALUE`
  cannot run inside a transaction and stranded migration 0012 on the live DB — the precedent and its
  reasoning are written up in `src/db/schema/event-results.ts:5-13` and `src/db/schema/auth.ts:40-45`.
  A token or income-source list is a value set that will grow; it must not be a Postgres type.
- **Integer minor units**, like `event_results.time_cs` and `REGISTRATION_PRICE_PLN` groszy
  (`src/lib/stripe/index.ts:18`). No floats in money, ever.
- **`text` user FKs** — Better Auth generates string ids (`src/db/schema/auth.ts:50`).
- **Additive migration only**: one new `src/db/migrations/` file generated by
  `npm run db:generate`, applied to a Neon branch first. No existing table is altered;
  `pending_registrations` stays untouched per ADR 0001.
- **One writer module.** All inserts go through `src/features/wallet/data.ts`; nothing else in the
  codebase issues `UPDATE`/`DELETE` on this table. Append-only is a code invariant, documented in
  the table's doc comment.

### Where it plugs into what exists

| Concern | File |
|---|---|
| Ledger writes + balance/history reads | `src/features/wallet/data.ts` *(new)* |
| Reward amounts config (1 / 1) | `src/features/wallet/config.ts` *(new)* — `PARTICIPATION_REWARD_ACER = 1`, `REFERRAL_REWARD_ACER = 1` |
| Participation accrual (`checked_in`) | `src/features/admin/checkin-actions.ts:193` `assignBibAndCheckIn` — key `participation:<registrationId>` |
| Referral accrual (referred person's **first** check-in) | same hook: on check-in, if the user has a referrer, credit the referrer with key `referral_checkin:<referredUserId>` (the unique index enforces once-per-referred-person) |
| Cabinet Wallet page (trilingual) | `src/app/[locale]/wallet/page.tsx` *(new)*, linked from `src/app/[locale]/profile/page.tsx`; keys in `src/messages/{pl,en,ua}.json` |
| Admin credit/debit + history | new page under `src/app/[locale]/admin/`, nav entry in `src/features/admin/components/shell/admin-nav.ts`, actions gated by `roleHasCapability(role, "edit")` (`src/lib/auth/roles.ts:31`) |
| ACER purchase checkout (phase B) | `src/features/wallet/purchase-actions.ts` *(new)*, modelled on `createCheckout` in `src/features/registration/actions.ts:79` |
| Purchase crediting (phase B) | branch in `src/app/api/stripe/webhook/route.ts:31` |
| Legal copy (phase B gate) | `terms.documents` in `src/messages/{pl,en,ua}.json`, rendered by `src/app/[locale]/terms/page.tsx` |

---

## 3. Phase plan

### Phase A — ledger + accruals + Wallet UI

1. `wallet_transactions` table + migration; balance and history reads in `src/features/wallet/data.ts`.
2. Accrual hooks, each idempotent by `idempotencyKey`:
   - **1 ACER** participation reward on check-in (`participation:<registrationId>`);
   - **1 ACER** to the referrer on the referred person's **first-ever** check-in
     (`referral_checkin:<referredUserId>` — one row per referred person, forever).
   - **No backfill** — past events earn nothing.
3. Cabinet Wallet page: three balances (ACER live; ACE(PL) and ACEG shown read-only at 0) +
   paginated history with the ТЗ 2.6.4.2 attributes (date-time, TxID, asset, signed amount,
   purpose, status). **No withdrawal affordance or mention anywhere.** Public UI, so pl/en/ua
   key parity.
4. Admin: per-user balance view, manual credit/debit with mandatory reason, `createdBy` audit,
   reversal action. Full-access admins only; admin UI is English-only by repo convention.

Ships value with **no payment, no legal and no Stripe exposure** — earning and displaying ACER only.
Phase A needs no counsel review.

### Phase B — buy ACER with a card via Stripe (gated on the legal task below)

1. New Checkout Session in **USD**: preset packs 10/25/50/100 ACER + custom whole-ACER amount
   (min 5, max 500), `metadata.kind = "acer_purchase"` plus `userId` and the ACER amount —
   the same metadata-branching isolation the event-registration plan used, so the legacy
   team-checkout path is not modified. Product copy says **"Ace Battle account credit"** —
   no token/crypto wording.
2. In `src/app/api/stripe/webhook/route.ts`, branch on `session.metadata?.kind` **before** the
   existing `promotePendingRegistration` call and `return` from the new branch. The legacy block
   keeps its exact current behaviour; it never sees an ACER session.
3. Credit by inserting one `kind: "purchase"` row with `idempotencyKey = "stripe:<session.id>"`.
   The unique index absorbs Stripe's at-least-once delivery — the existing webhook has no
   idempotency guard at all today, so this must not lean on "the webhook fires once".
4. Packs/bounds as constants next to `REGISTRATION_PRICE_PLN` in `src/lib/stripe/index.ts`.
   Store the fiat amount and currency in `memo`/`reference` for reconciliation against Stripe.
5. Checkout collects terms acceptance (Stripe `consent_collection.terms_of_service = "required"`)
   covering the wallet terms + the 14-day-withdrawal consent (see legal task).
6. Purchase history visible in the same ЛК list; refund handling = a `reversal` row (manual in v1).

### Phase B-L — legal copy (drafted with Phase B, **counsel review gates the purchase launch**)

All copy trilingual, added to the existing `terms.documents` structure in
`src/messages/{pl,en,ua}.json`:

1. **Terms of Use — new "ACER credit / Wallet" section**:
   - ACER is prepaid platform credit, usable only within the platform, non-transferable,
     non-withdrawable, no interest, denominated 1 ACER = 1 USD (PSD2 limited-network framing);
   - reward-program terms: amounts may change, erroneous accruals may be reversed, anti-abuse
     clause, program may be modified or ended;
   - refunds + the **EU/Polish 14-day consumer withdrawal right**: express consent to immediate
     delivery of the credit and acknowledgment of losing the withdrawal right at checkout, and/or
     refund of unspent purchased credit within 14 days;
   - what happens to a balance on account deletion;
   - what ACER will be redeemable for (paid entries, licences, prizes) — see the consumer note in §4-L.
2. **Privacy Policy updates**:
   - Stripe as data recipient (name, email, payment metadata; card data goes to Stripe directly),
     US transfer under DPF/SCCs;
   - new purposes + legal bases: payment processing (contract), transaction record-keeping
     (legal obligation), fraud prevention (legitimate interest);
   - retention carve-out: financial transaction records kept ~5 years per Polish accounting law,
     **surviving account-deletion requests**.
3. **Checkout consent checkbox** (Stripe consent collection) wired to the new terms.
4. **Accountant flags (outside the codebase, before Phase B launch)**: VAT treatment of the
   credit under the EU voucher rules (likely a multi-purpose voucher — VAT at redemption);
   faktura-on-request obligations for USD B2C sales.

Claude drafts all copy; **Polish counsel reviews the wallet terms before purchases go live.**
Phase A does not wait for this.

### Phase C — out of scope here, separate PRDs

Blink (Bitcoin Lightning) purchases, ACER↔ACE(PL)↔ACEG conversions, staking, DAO voting with
ACEG, on-chain (Polygon) issuance + WalletConnect, withdrawals (earned/prize ACER only, with
KYC/AML — purchased ACER stays spend-only), paid race entry, podium prize accruals.
None of them changes the Phase A ledger shape.

---

## 4. Explicit non-goals for v1

Not built, not stubbed, not implied by the UI:

- **Withdrawals and transfers** — no cash-out, no user-to-user transfer, **and no mention of
  withdrawal anywhere in the UI** (client decision, 2026-08-20). ACER is earned or bought, and
  spent inside the platform only.
- **Staking** — ACE(PL) and ACEG staking (ТЗ 2.6.2.4–2.6.2.5), fair-play deposits and season
  licence payments (ТЗ 2.6.2.6).
- **DAO voting** — the whole ТЗ §2.7 module. ACEG is a displayed balance with no powers in v1.
- **Conversions** between the three assets (ТЗ 2.6.2.2–2.6.2.3).
- **Web3 / on-chain** — no WalletConnect, no wallet linking, no Polygon contract, no gas
  (ТЗ §3.5). The ledger is internal; export comes later.
- **KYC** — no verification flow; it is a prerequisite of withdrawals, which are out.
- **Paid race entry** — registration stays free and uncapped (ADR 0001), so ACER cannot pay for a
  ticket in v1 and referral ticket income stays at 0.
- **ACE(PL) and ACEG issuance** — no rule creates them yet, so both balances read 0.
- **Podium prize accruals** — the `prize_reward` kind is reserved but nothing writes it yet;
  prize amounts are undefined.
- **Backfill** — no retroactive crediting of pre-launch check-ins or referrals.

### 4-L. Consumer-protection note (open risk, accepted for now)

In v1 there is nothing to spend ACER on — registration is free and prizes come later. Selling
credit with no current redemption is a consumer-protection soft spot and a chargeback magnet.
Mitigation shipped with Phase B: the terms and the purchase screen state clearly what ACER will
be redeemable for, and unspent **purchased** credit is refundable on request. The stronger
mitigation — holding Phase B until the first paid thing exists — was discussed and not chosen;
revisit if chargebacks appear.

---

## 5. Progress log
- 2026-08-20 — PRD #44 slice (issue #46): Phase B-L legal copy, commit `99298c8`. The existing
  `terms.documents` structure in `src/messages/{pl,en,ua}.json` gained, with full trilingual
  parity and no new route or component: a five-section ACER block in the **Terms of Use**
  (prepaid-credit definition + the PSD2 limited-network "not e-money" conclusion; reward-programme
  terms — amounts may change, erroneous accruals reversed by an offsetting entry, anti-abuse, no
  retroactive accrual, no claim to a reward; purchase + the Polish 14-day withdrawal right, with
  the express immediate-delivery request and the voluntary 14-day refund of unspent purchased
  credit; balance on account deletion; intended redemptions, stating plainly that there may be
  nothing to spend ACER on yet — §4-L mitigation), plus **Privacy Policy** updates (new "Data
  recipients and transfers outside the EEA" section naming Stripe, Inc./Stripe Payments Europe as
  independent controller of payment data, card details going directly to Stripe, US transfers
  under the DPF/SCCs; the three new purposes with legal bases — payment 6(1)(b), transaction
  records 6(1)(c), fraud prevention 6(1)(f); transaction data added to the collected-information
  list; a ~5-year Polish accounting retention carve-out that survives account-deletion requests).
  Zero crypto/token/stablecoin wording; "last updated" refreshed to 20 August 2026 on both
  documents. typecheck/build/lint clean, headings verified in the prerendered `/{pl,en,ua}/terms`
  output. **Copy is a draft — Polish counsel review still gates the purchase launch (Phase B),
  not Phase A.** Checkout consent wiring (Phase B-L item 3) belongs to issue #49, not here.
- 2026-08-20 — PRD #44 slice (issue #45): Phase A step 1 + 3 — the ledger and the cabinet wallet
  page. `wallet_transactions` (`src/db/schema/wallet.ts`, additive migration `0020`) exactly as §2
  specifies: `text` + `$type<>` for asset/kind/status, signed `bigint` minor units, partial unique
  index on `idempotency_key`, `(user_id, asset)` and `(user_id, created_at)`, no balance column, no
  existing table touched. `src/features/wallet/` holds the single writer plus the derived reads —
  `recordWalletTransaction` (targeted `ON CONFLICT (idempotency_key) WHERE … DO NOTHING`, so a
  replayed fact returns `null` while any other constraint still throws), `getWalletBalances`
  (`SUM` over `completed` rows, all three assets always present), `listWalletTransactions`
  (20/page, newest first, out-of-range clamped) — and the config constants (1 / 1 /
  [10,25,50,100] / 5–500; the pack + bounds numbers are declared here by the frozen Contracts for
  issue #49). `/[locale]/wallet` is `force-dynamic`, server-rendered with zero client islands:
  three balances (ACER live, Ace(PL)/ACEG read-only 0), the ТЗ 2.6.4.2 history row (date-time,
  full TxID, asset, signed amount, purpose, status pill) and a friendly empty state; gated with
  `redirectTo=/wallet` threaded through sign-up → verify-email → profile; linked from the profile
  nav. New `wallet` namespace, full pl/en/ua parity, labels for all nine kinds and three statuses.
  **No withdrawal affordance or mention anywhere.** Verified: typecheck/build/lint clean (`/wallet`
  builds as ƒ dynamic, lint baseline unchanged at 55); migration applied and the real data module
  driven against a throwaway Postgres 16 (idempotent replay, `completed`-only balances, reversal,
  per-user isolation, pagination); the app driven over HTTP in all three locales for guest →
  sign-up, the verify and profile hops, the empty wallet and a funded one (pending/failed rows
  rendering with their status). **A Neon branch was not available in this session** — the
  migration still needs applying there and to production. Accruals (#48), admin panel (#47) and
  purchase (#49) write to this ledger; nothing calls the writer yet.
- 2026-08-20 — PRD #44 slice (issue #48): Phase A step 2 — both automatic accruals, riding the
  existing check-in transition. `src/features/wallet/accruals.ts` holds one entry point,
  `awardCheckInRewards`: 1 ACER to the runner keyed `participation:<registrationId>`, and 1 ACER to
  `users.referred_by` keyed `referral_checkin:<referredUserId>` — once per referred person forever,
  so a sign-up alone still pays nothing. Amounts read #45's config constants. Hooked at the two
  UPDATEs in `events-data.ts` that every check-in funnels through, `checkInWithBib` (explicit /
  held / leased bib) and `checkInWithoutBib` (bib-pending), which is the Contracts' "data-layer,
  not actions" and makes exactly-once true by construction rather than by four callers remembering;
  `leaseBibForCheckedIn` deliberately does not credit (already present, already paid). Each accrual
  is guarded on its own and the function never throws — a wallet outage cannot fail a check-in, and
  a failed participation credit cannot cost the referrer theirs. `getReferrerId` was added to
  `src/features/referral/data.ts` (that feature owns `referred_by`), and a self-referral is skipped
  as well as refused at attribution time. **Accrual rows carry no memo**: the first cut wrote a
  formatted event label, which is an untranslatable English string on the money screen — the row
  instead carries `reference: event:<slug>`, renders with #45's trilingual `kind` label, and its own
  timestamp is the race night. Reverting a check-in leaves the credit standing by design; the
  append-only correction path is an admin `reversal` row (#47). No migration, no new strings, no
  backfill. Verified: typecheck/build clean, lint baseline unchanged at 55;
  `scripts/verify-wallet-accruals.ts` green at 39 checks against the real data layer (every path
  credits once, re-scan/retry/undo-recheck are no-ops, referrer paid once across two events,
  unreferred runner earns alone, a ledger refusing all inserts leaves the check-in committed and
  logged); and 26 HTTP checks green — a real check-in, then runner and referrer each signed in with
  their rows rendering on `/wallet`, `/en/wallet`, `/ua/wallet`. **A Neon branch was not available
  in this session** (throwaway Postgres 16 again); this slice adds no migration, but #45's `0020`
  still needs applying there and to production.
