# Wallet & Financial Assets — PRD v1

Scope: the ЛК "Wallet" module from `planning/ТЗ Личный Кабинет Ace Battle Sport v2.0.md` §2.6
(balances ACE[cc] / ACER / ACEG, ACER accrual, fiat purchase, transaction history).

Status: **spec only — nothing is implemented.** The codebase today has zero wallet/token/ledger
code; the only Stripe integration is the frozen legacy 50 PLN team checkout
(`src/lib/stripe/index.ts`, `src/app/api/stripe/webhook/route.ts:30`) — individual event
registration is free and uncapped (`docs/adr/0001-defer-paid-capped-registration-seam.md`).

Build tasks are **blocked on section 1**. Numbers below are the only unknowns that stop us.

---

## 1. Questions for the client (blockers)

Each question carries the answer we will proceed with if you simply say "your default is fine".

| # | Question | Our default if unanswered |
|---|---|---|
| 1 | **ACER price in PLN** — 1 ACER = ? PLN, and which purchase packs do we sell (e.g. 50 / 100 / 250 PLN)? | none — a price is required to ship Phase B |
| 2 | **Accrual amounts per source**: ACER for finishing a race; ACER for a podium place (1/2/3, individual vs team); ACER for a referred sign-up; % of a referred runner's ticket purchase; sponsor-referral reward. | flat "X ACER per completed race" only, all other sources at 0 until you set them |
| 3 | **Token decimals / precision** — is ACER whole-number only, or 2 decimals, or 18 (on-chain style)? | 2 decimals, stored as integer minor units |
| 4 | **Conversions in v1** — any ACE[cc]↔ACER↔ACEG exchange (ТЗ 2.6.2.2–2.6.2.3), and at what rate? | **no conversions in v1.** ACE[cc] and ACEG balances are displayed, read-only, always 0 until an issuance rule exists |
| 5 | **"Blink"** — which provider exactly? Blink the Bitcoin Lightning wallet API, or something else? Is it launch-critical, or is Stripe-first acceptable? | Stripe first, Blink deferred to its own phase |
| 6 | **Withdrawals ("вывод средств", ТЗ 2.6.4.1)** — in v1? Our recommendation: **no.** Purchase-and-earn only. Withdrawal turns ACER into stored value and drags in KYC, AML and payout rails. | no withdrawals in v1 |
| 7 | **Legal wrapper** — selling ACER for fiat in PL/EU can trigger e-money / MiCA obligations, and Stripe's Restricted Businesses list covers the sale of crypto-assets: an account presented as "selling tokens" can be refused or frozen. Who confirms the legal framing, and may we present ACER to Stripe as **prepaid in-platform credit** (not a crypto-asset)? | present as prepaid platform credit, non-withdrawable, non-transferable |
| 8 | **On-chain now?** ТЗ §3.5 implies Polygon + WalletConnect. Is an **off-chain ledger acceptable for v1**, with a documented export path to on-chain later? | off-chain ledger in v1 |
| 9 | **Paid tickets** — "Ticket Sales Income" (ТЗ 2.6.3.1) assumes paid race entry. Today every individual registration is free (ADR 0001). Do we add paid entry in this phase, or does that referral income line stay at 0? | stays at 0; paid entry is a separate PRD |
| 10 | **Who may credit/debit manually**, and does a manual adjustment need a second approver? | full-access admin only (`admin` role), single approver, every entry audited |

### 1-RU. Вопросы клиенту (блокеры)

Если на вопрос нет ответа — мы идём по варианту «по умолчанию» из таблицы выше.

1. **Цена ACER в PLN** — 1 ACER = ? PLN, и какие пакеты пополнения продаём (например 50 / 100 / 250 PLN)?
2. **Суммы начислений по источникам**: сколько ACER за финиш забега; за призовое место (1/2/3, индивидуально и в команде); за приведённого верифицированного пользователя; какой процент от покупки билета рефералом; вознаграждение за привлечённого спонсора.
3. **Точность токена** — ACER только целыми, или 2 знака после запятой, или 18 (как on-chain)?
4. **Конвертации в v1** — нужны ли обмены ACE[cc]↔ACER↔ACEG (ТЗ 2.6.2.2–2.6.2.3) и по какому курсу? Наша рекомендация: в v1 конвертаций нет, балансы ACE[cc] и ACEG показываем только для чтения.
5. **«Blink»** — какой именно провайдер? Это Blink (Bitcoin Lightning API) или что-то другое? Он критичен для запуска, или сначала достаточно Stripe?
6. **Вывод средств** (ТЗ 2.6.4.1) — нужен ли в v1? Наша рекомендация: **нет.** Только пополнение и начисления. Вывод превращает ACER в хранимую стоимость и тянет за собой KYC/AML и платёжные выплаты.
7. **Юридическая обёртка** — продажа ACER за фиат в Польше/ЕС может подпадать под требования к электронным деньгам и MiCA, а правила Stripe запрещают продажу крипто-активов без согласования: аккаунт, заявленный как «продажа токенов», могут заблокировать. Кто подтверждает юридическую конструкцию, и можем ли мы описывать ACER для Stripe как **предоплаченный внутренний баланс платформы** (не крипто-актив)?
8. **Нужен ли блокчейн сразу?** ТЗ §3.5 предполагает Polygon + WalletConnect. Допустим ли для v1 **внутренний off-chain реестр** с документированным путём выгрузки в блокчейн позже?
9. **Платные билеты** — «Доход от продажи билетов» (ТЗ 2.6.3.1) предполагает платную регистрацию. Сейчас регистрация на индивидуальные забеги бесплатная (ADR 0001). Вводим платную регистрацию в этой фазе, или эта статья дохода пока остаётся нулевой?
10. **Кто может начислять/списывать вручную**, и нужен ли второй подтверждающий для ручной корректировки?

---

## 2. Recommended architecture — off-chain append-only ledger

**Recommendation: one append-only ledger table, balances derived by `SUM`. No balance column.**

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
  what a later Polygon mint/airdrop script reads. Going on-chain first would put a 2-minute
  confirmation, gas costs and key custody between a runner and their check-in reward.
- **It fits repo policy**: one additive migration, no legacy table touched.

Balances are `SELECT asset, SUM(amount_minor) FROM wallet_transactions WHERE user_id = $1 AND status = 'completed' GROUP BY asset`.
With an index on `(user_id, asset)` this stays trivial at our volumes (hundreds of users, tens of rows
each). If it ever isn't, the fix is a cached projection *behind the same read function* — not a schema change.

### Proposed schema — `src/db/schema/wallet.ts` (new file, exported from `src/db/schema/index.ts`)

```ts
/** The three ЛК assets (ТЗ 2.6.1). ACE_PL is the ТЗ's ACE[cc] localised token. */
export type WalletAsset = "ACER" | "ACE_PL" | "ACEG";
export const WALLET_ASSETS: readonly WalletAsset[] = ["ACER", "ACE_PL", "ACEG"];

/** Why a row exists. Maps 1:1 onto ТЗ 2.6.3 income sources + purchase + admin correction. */
export type WalletTxKind =
  | "participation_reward"  // 2.6.3.2 Race Participation Income
  | "prize_reward"          // 2.6.3.2 Prize Pool Rewards
  | "referral_signup"       // 2.6.3.1 Ecosystem Expansion Income
  | "referral_ticket"       // 2.6.3.1 Ticket Sales Income (0 until paid entry exists)
  | "referral_sponsor"      // 2.6.3.1 Sponsor Attraction Income (admin-entered)
  | "purchase"              // 2.6.2.1 fiat -> ACER (phase B)
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
    /** Signed minor units (+ in / − out), scale per client Q3. Credit and debit are one column. */
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
     * "referral_signup:<referredUserId>", "stripe:<sessionId>". The unique index
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
- **Additive migration only**: one new `src/db/migrations/0019_*.sql` generated by
  `npm run db:generate` (latest on disk is `0018_greedy_klaw.sql`), applied to a Neon branch first.
  No existing table is altered; `pending_registrations` stays untouched per ADR 0001.
- **One writer module.** All inserts go through `src/features/wallet/data.ts`; nothing else in the
  codebase issues `UPDATE`/`DELETE` on this table. Append-only is a code invariant, documented in
  the table's doc comment.

### Where it plugs into what exists

| Concern | File |
|---|---|
| Ledger writes + balance/history reads | `src/features/wallet/data.ts` *(new)* |
| Participation accrual (`checked_in`) | `src/features/admin/checkin-actions.ts:193` `assignBibAndCheckIn` |
| Prize accrual (podium) | `src/features/admin/results-actions.ts:130` `commitResultsImport` |
| Referral sign-up accrual | `src/features/referral/data.ts:75` `applyReferralAttribution` |
| Cabinet Wallet page (trilingual) | `src/app/[locale]/wallet/page.tsx` *(new)*, linked from `src/app/[locale]/profile/page.tsx`; keys in `src/messages/{pl,en,ua}.json` |
| Admin credit/debit + history | new page under `src/app/[locale]/admin/`, nav entry in `src/features/admin/components/shell/admin-nav.ts`, actions gated by `roleHasCapability(role, "edit")` (`src/lib/auth/roles.ts:31`) |
| ACER purchase checkout (phase B) | `src/features/wallet/purchase-actions.ts` *(new)*, modelled on `createCheckout` in `src/features/registration/actions.ts:79` |
| Purchase crediting (phase B) | branch in `src/app/api/stripe/webhook/route.ts:31` |

---

## 3. Phase plan

### Phase A — ledger + accruals + Wallet UI (~1–1.5 weeks)

1. `wallet_transactions` table + migration; balance and history reads in `src/features/wallet/data.ts`.
2. Accrual hooks, each idempotent by `idempotencyKey`: participation on check-in, podium on results
   commit, referred sign-up on attribution. Amounts come from one config module so the client can
   change them without a migration.
3. Cabinet Wallet page: three balances (ТЗ 2.6.1) + paginated history with the ТЗ 2.6.4.2 attributes
   (date-time, TxID, asset, signed amount, purpose, status). Public UI, so pl/en/ua key parity.
4. Admin: per-user balance view, manual credit/debit with mandatory reason, `createdBy` audit,
   reversal action. Full-access admins only; admin UI is English-only by repo convention.

Ships value with **no payment, no legal and no Stripe exposure** — earning and displaying ACER only.
Deliverable is testable against real check-ins from the Aug/Sep events.

### Phase B — buy ACER with a card via Stripe (~0.5–1 week, gated on Q1/Q3/Q7)

1. New Checkout Session with `metadata.kind = "acer_purchase"` plus `userId` and the ACER amount —
   the same metadata-branching isolation the event-registration plan used, so the legacy team-checkout
   path is not modified.
2. In `src/app/api/stripe/webhook/route.ts`, branch on `session.metadata?.kind` **before** the existing
   `promotePendingRegistration` call and `return` from the new branch. The legacy block at line 31
   keeps its exact current behaviour; it never sees an ACER session.
3. Credit by inserting one `kind: "purchase"` row with `idempotencyKey = "stripe:<session.id>"`.
   The unique index absorbs Stripe's at-least-once delivery — the existing webhook has no
   idempotency guard at all today, so this must not lean on "the webhook fires once".
4. Prices/packs as constants next to `REGISTRATION_PRICE_PLN` in `src/lib/stripe/index.ts`.
   Store the fiat amount and currency in `memo`/`reference` for reconciliation against Stripe.
5. Purchase history visible in the same ЛК list; refund handling = a `reversal` row (manual in v1).

### Phase C — out of scope here, separate PRDs

Blink integration (once Q5 identifies the provider), ACER↔ACE[cc]↔ACEG conversions, staking,
DAO voting with ACEG, on-chain (Polygon) issuance + WalletConnect, withdrawals with KYC/AML.
Each needs its own product decisions; none of them changes the Phase A ledger shape.

---

## 4. Explicit non-goals for v1

Not built, not stubbed, not implied by the UI:

- **Staking** — ACE[cc] and ACEG staking (ТЗ 2.6.2.4–2.6.2.5), fair-play deposits and season licence
  payments (ТЗ 2.6.2.6).
- **DAO voting** — the whole ТЗ §2.7 module. ACEG is a displayed balance with no powers in v1.
- **Conversions** between the three assets (ТЗ 2.6.2.2–2.6.2.3).
- **Web3 / on-chain** — no WalletConnect, no wallet linking, no Polygon contract, no gas
  (ТЗ §3.5). The ledger is internal; export comes later.
- **Withdrawals and transfers** — no cash-out, no user-to-user transfer. ACER is earned or bought,
  and spent inside the platform only.
- **KYC** — no verification flow; it is a prerequisite of withdrawals, which are out.
- **Paid race entry** — registration stays free and uncapped (ADR 0001), so ACER cannot pay for a
  ticket in v1 and referral ticket income stays at 0.
- **ACE[cc] and ACEG issuance** — no rule creates them yet, so both balances read 0 until the client
  defines one (Q4).
