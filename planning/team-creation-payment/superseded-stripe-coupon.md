# Plan — team creation becomes a paid step (free at launch by an automatic coupon)

Goal: **creating a team costs money**, and on day one it costs nothing — the fee is charged
through Stripe with a 100 %-off coupon applied automatically by the server. Turning the money
on later is removing one environment variable, not shipping a payment flow.

The point of doing it this way rather than "free now, payments later" is that the whole paid
path — Checkout Session, webhook, promotion, idempotency, refusal copy — is **exercised in
production from day one**. A payment flow that has never taken a real round trip is not a flow,
it is a hope.

## Decisions taken (2026-09-09, with the owner)

| Question | Decision |
|---|---|
| Which moment is paid? | **`createTeam` only** (PRD #57 formation). Entering an event as a team (PRD #64, `enterTeam`) stays free, as does everything on the roster side. |
| Price | PLN, like the legacy race registration. `TEAM_CREATION_PRICE_PLN = 5000` (50.00 PLN in groszy) beside `REGISTRATION_PRICE_PLN` in `src/lib/stripe/index.ts`. **The number needs the owner's confirmation** — the currency does not. |
| How is it free at launch? | A real Stripe **coupon, `percent_off: 100`**, whose id lives in `TEAM_CREATION_COUPON_ID` and which the server attaches to every session (`discounts: [{ coupon }]`). Not `allow_promotion_codes` — the payer never types a code and cannot decline it. |
| Does the payer still see Stripe? | Yes. Total 0.00 PLN, and `payment_method_collection: "if_required"` means Stripe **does not ask for a card when the total is 0** (`node_modules/stripe/cjs/resources/Checkout/Sessions.d.ts:2226`). The session settles as `payment_status: "no_payment_required"`. |
| Who pays? | The creator — the person who becomes the team's manager. |
| When does the team row exist? | **Only after the session settles.** Creation becomes two-phase, exactly the shape ADR 0001 kept the seam for. |
| Refunds | None. Dissolving a team does not refund it, and re-creating charges again. Free at launch makes this moot today; it must be in the copy before the coupon comes off. |

Two calls made in-plan, both following existing idiom:

- **A misconfigured coupon fails closed.** If `TEAM_CREATION_COUPON_ID` is set and Stripe rejects
  it, the action refuses and logs loudly. It must never quietly fall through to charging 50 PLN
  because somebody mistyped an env var. (Unset is a different thing and means "full price" — that
  is the launch switch.)
- **Stripe-facing copy is resolved in the action, not in the service**, and passed down — the same
  split `createAcerPurchaseSession` uses, and for the same reason: the promotion half of the module
  is also called from the webhook, which has no request locale.

## What exists today

Three Stripe surfaces, one webhook route:

| Surface | Shape | Status |
|---|---|---|
| Legacy warsaw-2026 registration (`src/features/registration/`) | PLN Checkout → `pending_registrations` row → webhook promotes to `runners` | Frozen legacy (ADR 0008) |
| ACER wallet top-up (`src/features/wallet/purchase.ts`) | USD Checkout → webhook credits the ledger, keyed by session id | The modern precedent — copy its shape |
| Individual event registration | Free, no checkout | Unchanged by this plan |

`src/app/api/stripe/webhook/route.ts` already branches on `metadata.kind` (`acer_purchase`) and
returns before the legacy block. A third branch goes in the same place.

Team creation today (`src/features/teams/actions/team.ts:createTeam`) is one synchronous call:
gate → zod → eligibility → name-taken → `uniqueSlug` → `uniqueCode` → one transaction inserting
`user_teams` + the manager's `user_team_members` row → `{ ok: true, slug }`, and
`team-form.tsx:115` pushes the router at `/teams/<slug>`. Its only caller is that form; admins do
not create teams (they edit and dissolve, `admin-team-settings.tsx`).

## The one real problem: creation becomes two-phase

Everything else here is plumbing. The hard part is that the team must not exist until the money
(or the coupon) has settled, while the *uniqueness* of the name lives on the row that does not
exist yet.

**Chosen shape — a pending payload, promoted on settlement.** This is the `pending_registrations`
pattern ADR 0001 explicitly preserved as "the intake seam for a future paid flow", and it keeps
`user_teams` a table of real teams.

```
createTeam  ──gate, zod, eligibility, name-taken (all unchanged, all before Stripe)
            ──write pending_teams row
            ──open Checkout Session (discounts: [coupon])
            ──return { ok: true, status: "checkout", url }   ← form does a full navigation

settlement  ──webhook  checkout.session.completed  ─┐
            ──return page  /teams/new/complete      ─┴─► promotePendingTeam(sessionId)
                                                          idempotent, either may win
```

`promotePendingTeam` allocates the slug and the code, re-runs the name and eligibility checks, and
inserts the team + manager membership in one transaction — then deletes the pending row, the same
way `promotePendingRegistration` does (`src/features/registration/data.ts:160-193`).

**Idempotency lives on the real table**: `user_teams.checkout_session_id` gets a unique index, and
promotion opens by looking for a team already carrying this session. A redelivered webhook, a
refreshed return page, and the two racing each other all resolve to the same team — the second
insert loses on 23505 and re-reads the winner.

**Rejected: reserve an unpaid `user_teams` row at click.** It would make the name reservation
atomic, but it puts unpaid ghost teams in a table whose schema comment says out loud there is no
team status, they would hold names and codes forever without a sweeper, and every read across the
formation stack (`getTeamBySlug`, the recruiting list, admin index, entries) would need a
"…and paid" clause. One nullable payment column set is cheaper than a lifecycle.

## Slices

| # | Slice | Size | Ships as |
|---|---|---|---|
| 1 | Schema + creation service extracted | S/M | Invisible: teams still created synchronously and free |
| 2 | The paid path (Checkout, webhook, return page, UI, copy) | M | The feature — teams cost 50 PLN, coupon makes it 0.00 |
| 3 | Launch hygiene: expiry, admin visibility, ADR, verification | S | Confidence + written-down decisions |

### Slice 1 — schema and the service split (behaviour-neutral)

1. **`src/db/schema/pending-teams.ts`** — the in-flight payload.

   | Column | Notes |
   |---|---|
   | `id` uuid pk | |
   | `user_id` text → `users.id` `on delete cascade` | the future manager |
   | `payload` jsonb | name, region, category, recruiting, description — the zod-parsed `TeamFormInput` |
   | `locale` text | stamped server-side, survives the Stripe round trip (the registration flow's reason) |
   | `stripe_session_id` text **unique** | |
   | `amount_minor` integer, `currency` text | what was actually asked for, not re-derived later |
   | `coupon_id` text null | which coupon was attached, for reconciliation |
   | `failed_reason` text null | a `TeamActionReason` when promotion refused — see failure modes |
   | `expires_at`, `created_at` timestamptz | |

2. **`src/db/schema/user-teams.ts`** — four nullable columns on `userTeams`:
   `checkout_session_id` text **unique**, `paid_amount_minor` integer, `paid_currency` text,
   `paid_at` timestamptz. Nullable because every team created before this ships was free, and a
   backfill would be inventing payments that never happened.

3. **`src/features/teams/creation.ts`** — a plain module, **not** `"use server"`, mirroring the
   `entries.ts` / `actions/entries.ts` split: everything here is already past the gate, so a
   verification script can drive a real team creation without forging a session.
   - `uniqueSlug`, `uniqueCode`, `isUniqueViolation` move here from `actions/team.ts`.
   - `createTeamRows({ payload, managerUserId, payment? })` — the transaction that exists today,
     lifted verbatim, with the optional payment columns.
   - (Slice 2 adds `createPendingTeam`, `createTeamCheckoutSession`, `promotePendingTeam` here.)

4. **`src/features/teams/pricing.ts`** — pure data, importable by the client island:
   `TEAM_CREATION_PRICE_MINOR`, `TEAM_CREATION_CURRENCY = "pln"`, and nothing server-only.
   The coupon id is read from `process.env` in `creation.ts`, never here and never `NEXT_PUBLIC_` —
   a flag the browser can read is a flag the browser can be wrong about (the wallet's reasoning).

5. **Migration `0027_*`** via `npm run db:generate`. The live watermark is `when: 1788898663841`
   (`0026_gigantic_sentinel`) — a generated migration whose `when` predates it is **skipped in
   silence**. Check before applying. Additive only.

`createTeam` calls `createTeamRows` and still returns `{ ok: true, slug }`. Nothing else changes.

### Slice 2 — the paid path

1. **`creation.ts` grows the Stripe half.**
   - `TEAM_CREATION_KIND = "team_creation"` — the webhook discriminator, alongside
     `ACER_PURCHASE_KIND`.
   - `createTeamCheckoutSession({ pending, email, locale, copy })`:
     ```
     mode: "payment"
     locale: checkoutLocale(locale)            // pl → "pl", everything else → "en-GB"
     payment_method_types: ["card"]
     payment_method_collection: "if_required"  // no card asked for when the total is 0
     adaptive_pricing: { enabled: false }      // the price stays PLN
     client_reference_id: userId
     discounts: couponId ? [{ coupon: couponId }] : undefined
     metadata: { kind, pendingId, userId }
     line_items: [{ quantity: 1, price_data: { currency: "pln",
                    unit_amount: TEAM_CREATION_PRICE_MINOR,
                    product_data: { name: <stable, non-i18n>, description: copy.description } } }]
     success_url: <app>/<locale>/teams/new/complete?session={CHECKOUT_SESSION_ID}
     cancel_url:  <app>/<locale>/teams/new?checkout=cancelled
     ```
     `checkoutLocale` is currently private in `wallet/purchase.ts` — lift it to
     `src/lib/stripe/locale.ts` and have the wallet import it. Same behaviour, one definition.
     The product **name** is a stable English phrase like the wallet's `ACER_PRODUCT_NAME`
     (the anchor a disputing payer, an accountant and a lawyer all read); only the description is
     localised.
   - `isSettled(session)` — `payment_status === "paid" || payment_status === "no_payment_required"`.
     The second is the *only* one that happens while the coupon is on, and forgetting it is the
     single most likely way to ship this broken.
   - `promotePendingTeam(session)` → `{ outcome: "created" | "duplicate", slug } | { outcome:
     "refused", reason } | { outcome: "ignored" }`, in one transaction, in this order: team already
     carrying this session id? → pending row still there? → re-run `findTeamByName` and
     `checkEligibility` → `createTeamRows` with the payment columns → delete the pending row.
     A refusal writes `failed_reason` and keeps the pending row.

2. **`actions/team.ts:createTeam`** keeps every existing gate and refusal, then writes the pending
   row and opens the session. Return type becomes a discriminated success:
   `{ ok: true; status: "checkout"; url: string }`. `TeamActionResult<{ slug }>` stays the shape for
   `updateTeam` / `rotateTeamCode`. One new reason on the frozen union in `config.ts` —
   **`payment`** ("we could not open the payment page") — which the compiler will demand in all
   three catalogs.

3. **Webhook** (`src/app/api/stripe/webhook/route.ts`) — a branch before the ACER one, symmetrical
   with it: `metadata.kind === TEAM_CREATION_KIND` → `promotePendingTeam` → `return`. A thrown
   error answers **500 on purpose** so Stripe retries; promotion is idempotent, so a retry either
   creates the team or finds it. Also handle `checkout.session.expired` → delete the pending row.

4. **Return page** `src/app/[locale]/teams/new/complete/page.tsx` — dynamic, signed-in only:
   validates `?session=` against `/^cs_[A-Za-z0-9_]{1,240}$/` (the wallet's guard), retrieves the
   session from Stripe, checks it belongs to **this user**, promotes if settled, then
   `redirect("/teams/<slug>")`. Three other states, all rendered in place, mirroring the wallet's
   `settling`: not settled yet ("this takes a moment" + refresh), refused (`failed_reason` →
   `teams.reasons.<reason>`), and unknown session (back to `/teams/new`).

5. **UI** — `team-form.tsx` create branch: on `status === "checkout"`, `window.location.assign(url)`
   (a full navigation; `router.push` is for in-app routes). `TeamNewContent` renders the price line
   above the submit button, and passes `freeNow` down as a **prop resolved on the server** — struck
   price + "free while the series is launching" when the coupon is on.
   `/teams/new?checkout=cancelled` shows a neutral "nothing was charged" banner.

6. **Copy** in `src/messages/{pl,en,ua}.json`, key parity enforced: `teams.form.price*`,
   `teams.checkout.{settling,cancelled,refused}`, `teams.reasons.payment`, and the Stripe line-item
   description.

### Slice 3 — launch hygiene

- **Expiry.** Sessions get `expires_at` (30 minutes); `checkout.session.expired` deletes the pending
  row. A tiny sweep over `expires_at < now()` covers deliveries that never arrive — the
  `pending_registrations` table has carried a "TTL via cleanup job" comment and no job since it was
  written; do not add a second one.
- **Admin visibility.** `admin-team-settings.tsx` shows what the team paid: amount, currency,
  coupon, session id (the handle that finds it in the Stripe dashboard), or "created before
  payment" for the older rows.
- **ADR 0010 — team creation is paid; the launch coupon is the switch.** Records the two-phase
  decision, the fail-closed coupon rule, and the no-refund policy.
- **Runbook** (in the ADR): the Stripe dashboard steps, below.
- **Verification** per the `/verify` skill.

## Stripe dashboard and environment

Create the coupon **in test mode and in live mode** — ids do not cross modes:

- Coupon: `percent_off: 100`, `duration: once`, id `TEAMS_LAUNCH_FREE`, no `max_redemptions`, no
  `redeem_by` (a coupon that silently expires is a coupon that silently starts charging people).
- `TEAM_CREATION_COUPON_ID=TEAMS_LAUNCH_FREE` in `.env.local` and in Vercel (both environments).
- Webhook endpoint: already configured (`STRIPE_WEBHOOK_SECRET`). Add **`checkout.session.expired`**
  to its enabled events; `checkout.session.completed` is already on.
- Nothing else is needed — `STRIPE_SECRET_KEY`, the publishable key and the webhook secret are the
  existing ones.

**Going paid later** is one change: unset `TEAM_CREATION_COUPON_ID`. The price line un-strikes
itself, Stripe starts collecting a card, and `payment_status` becomes `paid` on the branch that has
been running all along.

## Failure modes

| What | What happens |
|---|---|
| Name taken while the creator was at Stripe | Promotion refuses `name_taken`, pending row keeps `failed_reason`, the return page says so. Free phase: nothing to refund. **Before the coupon comes off**, this needs a refund path — flagged in slice 3's ADR, not built here. |
| Creator joined another team in that category meanwhile | Same shape, reason `already_in_category`. |
| Webhook and return page promote simultaneously | Unique index on `checkout_session_id`; the loser catches 23505 and re-reads the winner's team. |
| Stripe redelivers `completed` | Promotion finds the team by session id → `duplicate`, no second team. |
| Coupon id wrong / deleted | Session creation throws → `createTeam` returns `payment`, logs loudly, **no team and no charge**. Fails closed. |
| Payer abandons Stripe | Pending row expires and is deleted; no team, no name held. |
| Account deleted between checkout and settlement | FK 23503 on promotion → log, return `ignored`, answer 200 (the wallet's `isMissingUser` precedent) so Stripe stops retrying a permanent failure. |

## Verification (slice 3)

Static gate `npm run typecheck && npm run lint && npm run build`, then:

- **Stripe test mode, real round trip**: `stripe listen --forward-to localhost:3000/api/stripe/webhook`,
  create a team in each of pl/en/ua, confirm Stripe asks for **no card**, the total reads 0.00 PLN,
  the team appears, and `user_teams` carries the session id and `paid_amount_minor = 0`.
- **Coupon off** (`TEAM_CREATION_COUPON_ID` unset): Stripe asks for a card and the total is
  50.00 PLN. Use `4242…`, then confirm `payment_status: "paid"` promotes on the same branch.
- **Idempotency**: `stripe events resend <evt_…>` → still one team.
- **DB round trip** through `creation.ts` directly (no session forging), scoped to the ids it
  creates — this checkout verifies against the **live** database, so a broad delete is not an option.
- **HTTP gate**: grep for a content marker on `/teams/new` (the price line) in all three locales
  rather than trusting a 200 — streaming makes a redirect look like a 200.
- Verification scripts must not import anything that sends mail: `.env.local` holds a real Resend
  key and a top-level `process.env` assignment cannot disable it (imports hoist).

## Ground rules inherited

Read `node_modules/next/dist/docs/` before writing Next code — this is a custom Next 16 and the
route/segment APIs differ from training data. Migrations additive-only, watermark checked. Public
UI trilingual with pl/en/ua key parity; admin UI English-only. This checkout is shared by several
sessions — check mtimes before committing, never `git add -A`. Run
`docs/agents/cross-cutting-checklist.md` before calling a slice done.

## Open questions for the owner

1. **The number.** 50.00 PLN is the legacy registration price, used here as a placeholder. Confirm.
2. **Terms acceptance at checkout.** The wallet forces a terms tick (`consent_collection`) because
   ACER carries a 14-day withdrawal right. A team creation fee may want the same — it also requires
   a Terms of Service URL in the Stripe dashboard or session creation fails. Default in this plan:
   **off**. Say if counsel wants it on.
3. **Invoices.** Charging PLN for a service will eventually need `invoice_creation` and a VAT
   answer. Out of scope here; free at launch means no invoice is due yet.
4. **Does an admin ever create a team for someone?** Today they cannot. If that arrives later it is
   the one path that legitimately bypasses payment.
