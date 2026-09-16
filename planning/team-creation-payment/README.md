# Plan — team creation costs 100 ACER; admins grant ACER to many users at once

Decided with the owner on 2026-09-15. **Supersedes** `superseded-stripe-coupon.md` in this folder
(50 PLN Stripe Checkout + 100 %-off launch coupon, two-phase `pending_teams` promotion). Two of its
decisions carry over unchanged and are restated below; everything Stripe-shaped is gone.

The owner's word for the currency is "aces". In this codebase that is **ACER**, the wallet asset
(`src/db/schema/wallet.ts`, pegged 1 ACER = 1 USD in live copy). "ACE" is a race role
(`rating-rules.ts`), so the currency is never called "aces" in code, copy keys or UI.

## Goal

1. **Creating a team costs 100 ACER**, debited from the creator's wallet at the moment the team is
   created. No Stripe, no pending state: the wallet is ours, so the payment is synchronous and the
   team row, the debit and the manager membership land in **one transaction** or not at all.
2. **Admins credit ACER to several selected users in one action**, from the users list, with a
   mandatory reason and the same audit trail the existing per-user credit has. Not bound to Stripe.

## Decisions

Written down as [ADR 0010 — team creation is paid in ACER](../../docs/adr/0010-team-creation-paid-in-acer.md).

| Question | Decision |
|---|---|
| Which moment is paid? | **`createTeam` only** (PRD #57 formation). `enterTeam` (PRD #64) and everything roster-side stay free. *(carried over)* |
| Price | `TEAM_CREATION_PRICE_ACER = 100`, declared in `src/features/wallet/config.ts` ("wallet economics in one place"). Whole ACER, debited as `acerToMinor(100)`. |
| Currency | ACER only. Ace(PL) and ACEG are unissued and read 0 (PRD #44). |
| Who pays? | The creator — the person who becomes the manager. |
| When does the team row exist? | Immediately, in the same transaction as the debit. No pending table. |
| Refunds | **None on dissolve**; re-creating charges again. An admin can still return the money as a `reversal` row of the `team_creation` row if a case ever warrants it. *(carried over)* |
| Which ACER is spent? | Whatever the balance is — earned and purchased ACER are one number per asset. Spending purchased ACER on a team is exactly what the wallet copy says it is for ("paid entries … and comparable paid features"). |
| Existing teams | Untouched. No backfilled debits — that would be inventing payments that never happened. |
| Admin creating teams | There is no such path today (admins edit and dissolve only), so there is no fee-bypass to design. If one arrives later it is the one legitimate free path. |
| Bulk grant direction | **Credit only.** A bulk *debit* is a mistake magnet; debits stay on the per-user form where the admin is looking at one ledger. |
| Bulk grant kind | Reuses `admin_credit`. Same label, same reversal path, same audit columns. A new kind would split "manual credit" across two names for one fact. |

## What exists today (read before touching anything)

| Piece | Where | State |
|---|---|---|
| Append-only ledger, balance = `SUM(amount_minor) WHERE status='completed'` per (user, asset) | `src/db/schema/wallet.ts`, `src/features/wallet/data.ts` | Shipped (#45). `kind`/`asset`/`status` are `text` + `$type<>` — **adding a kind is a TypeScript change, no migration.** |
| Single writer `recordWalletTransaction`; idempotency by partial unique index on `idempotency_key` | `src/features/wallet/data.ts` | Uses `getDb()` directly — **not transaction-aware yet.** Slice 1 fixes that. |
| Per-user manual credit/debit with mandatory reason, `created_by` audit, reversal | `src/features/admin/wallet-actions.ts`, `components/wallet-panel.tsx` on `/admin/users/[id]` | Shipped (#47). Gated `requireAdmin(locale, "edit")`. Typo guard `MAX_ADJUSTMENT_ACER = 100_000`, `MAX_REASON_LENGTH = 500`. |
| ACER purchase via Stripe | `src/features/wallet/purchase.ts` | Shipped (#49) but **off** unless `ACER_PURCHASE_ENABLED=1`. Not set in `.env.local`. |
| Accruals: 1 ACER per check-in, 1 ACER per referred person's first check-in | `src/features/wallet/accruals.ts` | Shipped (#48). |
| Team creation | `src/features/teams/actions/team.ts:createTeam` | One transaction: gate → zod → eligibility → name-taken → `uniqueSlug`/`uniqueCode` → insert `user_teams` + manager `user_team_members`. Sole caller `team-form.tsx`. |
| Transaction-composable data layer | `src/lib/db/index.ts` — `DbExecutor`, `executor(tx)` | The pattern team check-in uses. Adopt it, do not invent another. |
| Row locking idiom | `select … for update` on team / invitation rows (`join-requests.ts`, `invitations.ts`) | Precedent for the balance lock below. |
| Selectable admin table + bulk server action | `components/roster/roster-table.tsx` (`"use client"`, checkbox column), `heat-actions.ts` (`formData.getAll("registrationIds")`) | Precedent for slice 3. |
| Users list | `src/app/[locale]/admin/users/page.tsx`, `features/admin/users-data.ts` | Server component, 50/page, filters + sort in the URL, `userAggregates` already joins two per-user aggregates. |

**Consequence worth saying out loud:** with purchases off and 1 ACER per check-in, 100 ACER is
unreachable without an admin grant. In practice slice 3 *is* the approval step for founding a
team. That is acceptable to the owner; it is also why slice 3 ships before the price is announced.

## The one real problem: the balance race

There is no balance column to `UPDATE … WHERE balance >= 100`. Two concurrent `createTeam` calls
from the same user (double-click, two tabs) each read `SUM = 100`, each pass, and the user ends
up at −100 with two teams. The fix is to serialise per user inside the existing transaction:

```
db.transaction(async (tx) => {
  select id from users where id = $userId for update      -- per-user mutex, codebase idiom
  balance = SUM(amount_minor) … for update-safe read on tx  -- via getAcerBalance(userId, tx)
  if balance < price → throw InsufficientBalance           -- caught outside → teamFailure("insufficient_balance")
  insert user_teams … returning id
  recordWalletTransaction({ kind: "team_creation", amountMinor: -price,
                            reference: `team:${slug}`, idempotencyKey: `team_creation:${teamId}` }, tx)
  insert user_team_members (manager)
})
```

The balance is **also** checked before the transaction so the everyday case is a message, not a
rollback — the same shape as the `findTeamByName` pre-check whose truth is really the unique index.

Rejected: `pg_advisory_xact_lock(hashtext(userId))`. Works, but the codebase has no advisory-lock
precedent and the users row is a perfectly good mutex. Rejected: a stored balance column — the
schema comment explains why, and this plan does not reopen it.

## Slices

| # | Slice | Size | Ships as |
|---|---|---|---|
| 1 | Ledger plumbing (executor param, new kind + labels, price constant) | S | Invisible; unblocks 2 and 3 in parallel |
| 2 | Paid `createTeam` + `/teams/new` price and balance UI + copy ×3 | M | The fee |
| 3 | Admin bulk credit from the users list + ACER balance column | M | The grant |
| 4 | ADR 0010, CONTEXT.md terms, verification | S | Written-down decisions |

Slices 2 and 3 are independent once 1 has landed. No slice needs a migration — check anyway that
nobody has generated one by accident (`src/db/migrations/meta/_journal.json`; live watermark is
`0026_gigantic_sentinel`, `when: 1788898663841`).

### Slice 1 — ledger plumbing (behaviour-neutral)

1. **`src/features/wallet/data.ts`**
   - `recordWalletTransaction(input, tx?: DbExecutor)` — `executor(tx).insert(…)`. Every existing
     caller passes nothing and behaves exactly as before. The "single writer" doc comment gains
     one sentence: composing into a caller's transaction goes through this parameter, never
     through a second insert site.
   - `getAcerBalance(userId, tx?: DbExecutor): Promise<number>` — minor units, `completed` rows,
     asset `ACER`. A narrow read beside `getWalletBalances`, because the spend path needs one
     number inside a transaction and the three-asset record is the wrong shape there.
2. **`src/db/schema/wallet.ts`** — `WalletTxKind` gains `| "team_creation" // spend: founding a team (PRD team-creation-payment)`.
   The compiler then demands:
   - `WALLET_KIND_LABEL.team_creation = "Team creation"` in `features/admin/wallet-copy.ts`;
   - `wallet.kinds.team_creation` in `src/messages/{pl,en,ua}.json` (key parity is enforced).
3. **`src/features/wallet/config.ts`** — `export const TEAM_CREATION_PRICE_ACER = 100;` with a doc
   line saying what it buys and that changing it is a deploy, not a migration.
4. **`src/features/teams/config.ts`** — `TeamActionReason` gains `| "insufficient_balance"`, with
   `teams.reasons.insufficient_balance` ×3 ("You need {price} ACER to create a team. Your balance
   is {balance}." — or a plain sentence if the reason channel cannot carry values; see slice 2).

### Slice 2 — the paid create

1. **`actions/team.ts:createTeam`** — after the existing gates and the name pre-check:
   - pre-check `getAcerBalance(actor.userId) >= acerToMinor(TEAM_CREATION_PRICE_ACER)` →
     `teamFailure("insufficient_balance")`;
   - the transaction above. The `for update` on `users` and the in-tx balance read are what make
     the pre-check true; an in-tx shortfall is thrown as a sentinel and mapped to the same refusal
     in the existing `catch` beside the 23505 mappings.
   - Return shape **unchanged**: `{ ok: true, slug }`. `team-form.tsx` keeps its `router.push`.
   - If `TEAM_CREATION_PRICE_ACER` is 0 the debit is skipped entirely — no zero-amount rows in the
     ledger. This is the only "free switch" this plan offers; the owner did not ask for one.
2. **`/teams/new`** (`team-new-content.tsx`, server): resolve `balance = getAcerBalance(user.id)`
   past the verify/profile/age gates and pass `{ priceAcer, balanceMinor }` down to `TeamForm`
   as props. The form shows a price line above the submit ("Creating a team costs **100 ACER**.
   Your balance: 37 ACER."), relabels the create button `submitCreate` → "Create the team for
   {price} ACER", and when short **disables submit** and shows "You need {missing} more ACER" with
   a link to `/wallet`. The link's wording must not promise a top-up unless
   `isAcerPurchaseEnabled()` — resolve that server-side and pass it as a prop too.
   `createSubtitle` ("Your team exists the moment you save it") stays true and stays.
3. **Wallet history** (`features/wallet/components`, runner side) and the admin ledger: a row
   whose `reference` is `team:<slug>` renders the slug as a link to `/teams/<slug>`. Small, and
   it is the thing that answers "what was this 100 for".
4. **Copy** ×3, key parity: `teams.form.priceLine`, `teams.form.balanceLine`,
   `teams.form.shortBy`, `teams.form.walletLink`, `teams.form.submitCreatePaid`,
   `teams.reasons.insufficient_balance`, `wallet.kinds.team_creation` (slice 1). Public UI is
   trilingual; the numbers travel as ICU arguments, never concatenated.

### Slice 3 — admin bulk credit from the users list

1. **Selection island** — a `"use client"` wrapper around the users table body that adds a
   checkbox column (page-level select-all with `indeterminate`, per-row toggle, the roster
   table's exact affordances) and mirrors selected ids into hidden `userIds` inputs of one
   `<form action={creditWalletBulk}>`. Selection is per page; it does not survive paging, and
   the bar says so ("12 selected on this page").
2. **Bulk bar** (Tailwind admin layer, ADR 0004): amount (whole positive ACER, `min=1`,
   `max=MAX_ADJUSTMENT_ACER`), reason (`maxLength=MAX_REASON_LENGTH`), a hidden `batchId`
   (uuid minted when the page renders), the `ConfirmSubmit` button reading "Credit 12 people".
   Rendered only when `userCan(actor, "edit")`; the action re-checks.
3. **`features/admin/wallet-actions.ts:creditWalletBulk(formData)`**
   - `requireAdmin(locale, "edit")`.
   - `userIds = formData.getAll("userIds")`, de-duplicated, `1 ≤ n ≤ MAX_BULK_RECIPIENTS` (200 —
     a typo guard like the amount cap, declared in `wallet-data.ts`).
   - amount: positive integer ACER, `≤ MAX_ADJUSTMENT_ACER`; reason: mandatory, `≤ 500`.
   - `batchId` must be a uuid; refuse otherwise.
   - verify every id exists (`select id from users where id in (…)`), refuse naming the count
     missing rather than crediting a subset silently.
   - one `db.transaction`: for each user `recordWalletTransaction({ userId, asset: "ACER",
     amountMinor: acerToMinor(amount), kind: "admin_credit", memo: reason, createdBy: admin.id,
     reference: \`grant:${batchId}\`, idempotencyKey: \`grant:${batchId}:${userId}\` }, tx)`.
   - The key makes a **double submit a no-op** (every row returns `null`, reported as "already
     credited"), while a fresh page render mints a fresh batch, so a deliberate second grant to
     the same people still works. This is a refinement of the per-user form's "deliberately
     repeatable, no key" stance, not a reversal of it: the per-user form keeps its behaviour.
   - `reference = grant:<batchId>` is the handle that finds every row of one grant in the ledger;
     reversal stays per row through the existing `reverseWalletTransaction`.
   - Report on the list page's existing `?msg=` channel, preserving the current filters/sort/page
     in the redirect: "Credited 100 ACER to 12 people — recorded against your account."
4. **ACER balance column** on the users list: one more aggregate in `userAggregates`
   (`sum(amount_minor) where status='completed' and asset='ACER' group by user_id`, left-joined),
   rendered with `formatWalletBalance(minor, "en")`. Sortable is optional; showing it is not —
   choosing whom to credit needs to see who already has it. Add `acerBalanceMinor` to
   `UserListRow`.
5. Admin UI is English-only by repo convention — no catalog keys.

### Slice 4 — hygiene

- **ADR 0010 — team creation is paid in ACER from the wallet.** Records: synchronous debit in the
  team transaction, the per-user `for update` mutex, the `team_creation` kind, no refund on
  dissolve, credit-only bulk grants keyed by batch, and that the Stripe/coupon design was
  considered and superseded (link `superseded-stripe-coupon.md`).
- **CONTEXT.md** — add the spend to the wallet/teams terms: *Team creation fee*, *Grant*.
- **`docs/agents/cross-cutting-checklist.md`** run per slice.
- **Verification** below.

## Failure modes

| What | What happens |
|---|---|
| Balance short | `insufficient_balance` before the transaction; UI already disabled submit, so this is the double-tab case. No team, no row. |
| Two creates race on one wallet | Second waits on the `users` row lock, re-reads the balance inside its own tx, refuses. Exactly one team, exactly one debit. |
| Name taken while paying | Same transaction — the 23505 rolls the debit back with the team. No money moves for a refused team. |
| Team dissolved | Debit stands (decision). Admin `reversal` if ever warranted. |
| Bulk form double-submitted | Every row hits the `grant:<batch>:<user>` key → `null` → "already credited". |
| Bulk list contains a deleted user | Refused before any insert, naming how many ids were not found. |
| Admin credits the wrong batch | Find all rows by `reference = grant:<batchId>` on each user's ledger; reverse row by row (existing action). |
| Price changed by deploy while a form is open | The action reads the constant, not the form — the form's price line is display only. |

## Verification

Static gate `npm run typecheck && npm run lint && npm run build`, then per the `/verify` skill:

- **DB round trip through `actions/team.ts`'s transaction body** (extract the tx body into a
  plain function in `features/teams/creation.ts` so a script can drive it without forging a
  session): grant a fixture user 100 ACER via `recordWalletTransaction`, create a team, assert
  one `team_creation` row of −10 000 minor keyed `team_creation:<teamId>`, balance 0, then a
  second create refuses `insufficient_balance`. **Scope every delete to the ids created — this
  checkout verifies against the live database.**
- **Race**: fire two creates concurrently for one user holding exactly 100 ACER; assert one team
  and one debit.
- **HTTP gate**, all three locales: `/teams/new` shows the price line (grep a content marker,
  not a 200 — streaming makes a redirect look like a 200); with a short balance the submit is
  disabled and the shortfall sentence renders.
- **Admin**: drive `/admin/users` via a temp signed session row; select two fixture users,
  credit 5 ACER with a reason, assert two `admin_credit` rows sharing `reference grant:<batch>`,
  re-submit the same form → "already credited" and no new rows. Balance column reflects it.
- Verification scripts must not import anything that sends mail: `.env.local` holds a real
  Resend key and a top-level `process.env` assignment cannot disable it (imports hoist).

## Ground rules inherited

Read `node_modules/next/dist/docs/` before writing Next code — this is a custom Next 16 and the
route/segment APIs differ from training data. No migration is expected; if one appears, check
its `when` against the live watermark or it is skipped in silence. Public UI trilingual with
pl/en/ua key parity; admin UI English-only, Tailwind layer (ADR 0004). This checkout is shared by
several sessions — `src/messages/*.json` currently carry someone else's uncommitted edits, so
check mtimes before committing and never `git add -A`. Run
`docs/agents/cross-cutting-checklist.md` before calling a slice done.

## Open questions for the owner (none block slice 1)

1. **Price versus peg.** Live copy says 1 ACER = 1 USD. A 100 ACER fee reads as a 100 USD fee to
   anyone who buys ACER to pay it. Intended, or should the peg copy be revisited before purchases
   go live?
2. **Fee waiver.** No admin path creates teams today. Wanted?
3. **Bulk selection across pages** ("credit everyone matching this filter") is out of scope here.
   Say if it is needed for the launch grant and slice 3 grows a "credit all N matching" branch.
