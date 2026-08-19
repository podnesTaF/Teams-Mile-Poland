# Plan: client email 2026-08-18 (admin panel + personal cabinet)

Source: client email "Вопросы к Алексею по админке и контрольной панели" (Aug 18).
Referral program is confirmed done and excluded from the work plan (state summarized in §2 for the reply to the client).

Status legend: ✅ already shipped · 🟡 shipped but needs fixes/verification · 🔴 not built.

## Summary table

| # | Email item | Status | Work left |
|---|---|---|---|
| 1 | Google ID registration fix | 🟡 | Fix landed in `508ad15`, never verified live; verify + regression guard |
| 2 | Referral program (link, tracking, stats in cabinet + admin) | ✅ | Optional polish only (§2) |
| 3 | Admin access levels (view/edit/check-in) | ✅ | Nav polish + audit sweep (§3) |
| 4 | Users list: reg date, participations, totals row | ✅ | Sort bug, pagination, phone search, "confirmed profile" stat (§4) |
| 5 | Volunteer QR check-in interface | ✅ | UX hardening at the edges (§5) |
| 6 | Wallet ACER / ACE(PL) / ACEG, Stripe/Blink, buy ACER | 🔴 | Entire subsystem; needs product decisions first (§6) |
| 7 | Who are the Aug-29 participants? | — | Answered: fixture debris + real open registration; cleanup task (§7) |
| 8 | Client analytics: participations, personal ratings | 🟡 | Unify "races" definition, person-level leaderboard, admin detail stats (§8) |
| 9 | Duplicate user check (email, phone) | 🔴 | New: normalization keys + duplicates report + registration-time warning (§9) |

## 1. Google sign-in (Проверить и починить регистрацию через Google ID) — 🟡 verify the fix

The reported failure (imported passwordless users hitting `account_not_linked`) was root-caused and **fixed in commit `508ad15`**: `accountLinking { enabled: true, trustedProviders: ["google"], requireLocalEmailVerified: false }` in `src/lib/auth/better-auth.ts:146-150`. Against better-auth 1.6.23 internals, every refusal clause is now false for a passwordless imported user — Google links to the existing row and flips `emailVerified: true`. The fix has no test, no phase-log entry, and was never driven live.

Slice (S):
1. Live verify: Google sign-in as (a) an imported passwordless user, (b) an existing email+password user, (c) a brand-new user; confirm account row linked, `emailVerified` flipped, profile fields mapped from `given_name`/`family_name`.
2. Regression guard: `requireLocalEmailVerified` is deprecated upstream and slated to become unconditional (comment at `better-auth.ts:142-145`) — a minor bump can silently re-break this. Pin better-auth or add a startup assertion/test around the linking config.
3. UX: `?error=` bounce-back renders one generic `errors.oauthCallback` message (`sign-in-form.tsx:25-27`); distinguish "linking refused" from config errors at least in logs.
4. Log the fix in the mile-series phase log (currently only the *problem* is recorded, line 144).

## 2. Referral program — ✅ done (for the client reply) + optional polish

Done and shipped (commit `508ad15`, migration 0017): link generation (`/r/<code>`, lazy unique code, 90-day cookie), attribution on all three account-creation paths incl. Google and guest flow, derived funnel stats (sign-ups → race registrations → checked-in participation), cabinet section on `/profile#referrals`, admin page `/admin/referrals` with totals + per-referrer table.

Optional polish backlog (not committed to):
- **Definition inconsistency (worth fixing)**: referral "participation" counts only `event_registrations.status = 'checked_in'`, ignoring `legacy_participations`, while `users-data.ts:41-45` claims they match. Pick one definition (see §8) and align.
- Admin drill-down: list of *who* a referrer invited, per-event breakdown; referrer/referred shown on `/admin/users/[id]`.
- Attribution gap: guest registration under an *existing* email updates the user without firing the create-hook — no attribution. Cookie-only attribution (no `?ref=` fallback) loses cross-browser hops.
- Share surfaces: link only lives on the profile page; no post-registration share prompt, no QR.

## 3. Admin access levels (Разграничение прав доступа) — ✅ done + polish slice

Already implemented end to end: three roles `admin` / `admin_checkin` / `admin_viewer` on `users.role` (`src/lib/auth/roles.ts`), capabilities `view/edit/checkin` enforced by `requireAdmin(locale, capability)` on ~40 mutation actions and every admin page, management UI at `/admin/admins` (invite, resend, change access, remove; last-full-admin and self-demotion guards), bootstrap CLI `scripts/grant-admin.ts`. No shared admin password remains in `src/`.

Polish slice (S):
1. Capability-filter `buildAdminNav` (`admin-nav.ts:68+`) — an `admin_viewer` currently sees "Scan ticket" (and Users/News/Mailings) and gets a bare 404.
2. Sweep view-gated pages (roster, heats, results, mailings) confirming mutation controls are hidden for viewers the way `users/page.tsx` and `admins/page.tsx` do.
3. Clean stale artifacts: `ADMIN_PASSWORD` mention in `planning/mile-series-plan.md:125`, dead `tm_admin_session` cookie in `scripts/http-fixture.ts:89`, unused legacy `/api/ticket/check-in` + `CHECKIN_API_KEY` (decide: delete or keep documented).
4. Optional (ask client): audit log of admin mutations — `requireAdmin` already returns the actor, so a small append-only table is cheap.

## 4. Admin users list (дата регистрации, участие, общая статистика) — ✅ done + fixes slice

Already shipped on `/admin/users`: **Signed up** (createdAt), Verified pill, First event badge, **Aug regs**, **Races run** columns; totals line "«N» people in the system · «M» verified · «K» matching filters" from `getUserStats()`.

Fixes slice (S/M):
1. **Sort bug**: `listUsers` docblock says "Newest accounts first" but orders `asc(users.name)` (`users-data.ts:55` vs `:141`). Make it `desc(createdAt)` + add sort controls.
2. **Pagination**: the query returns every row — reuse the roster pagination idiom before the table grows past a few hundred users.
3. Search: `q` covers name+email only — add phone; add a phone column.
4. **"Confirmed profiles" clarification**: admin "verified" = `emailVerified`; `isProfileComplete` (firstName+lastName+DOB+sex+phone) exists but isn't surfaced anywhere in admin. Ask the client which they mean by "подтвержденных профилей"; likely add a third total + filter for profile-complete.
5. Optional: CSV/XLSX export of the filtered list (pattern exists in `export-runners.ts`), registration-date range filter.

## 5. Volunteer QR check-in — ✅ built end to end + hardening slice

Already shipped: in-app camera scanner at `/admin/scan` (jsQR, gated `checkin`), ticket QR encodes `/tickets/<id>?s=<sig>`; that public page renders an inline **TicketAdminPanel** (check-in button with auto bib lease, waiting-list assign, heat info, back-link to the desk) whenever the viewer's session has the `checkin` capability. Bib assignment with held-bib confirmation, lowest-free suggestion, retries, bib-less waiting list (ADR 0003). Desk page accepts pasted ticket URLs with server-side signature verification.

Hardening slice (M):
1. **Signed-out scan dead-end**: a phone-camera scan opens the public ticket with no hint for a volunteer who isn't signed in in that browser. Add a discreet "Staff? Sign in to check in" affordance on `/tickets/[id]` (redirectTo back to the ticket + `#admin`).
2. **Scan-next loop**: after check-in via the panel, offer "Scan next runner" back to `/admin/scan` — currently the volunteer re-navigates manually each time.
3. Panel parity: allow typing a specific bib and mark-no-show/undo on the TicketAdminPanel (today desk-only; copy tells the volunteer to bounce to the desk).
4. Ops prep: one-page volunteer instruction (sign in on their phone once → use `/admin/scan`, not the native camera); create `admin_checkin` accounts ahead of race morning.
5. Known quirk: bad-signature ticket page returns HTTP 200 with a not-found body — cosmetic, fix opportunistically.

## 6. Wallet (ACER / ACE(PL) / ACEG, Stripe/Blink, покупка ACER) — 🔴 greenfield, spec first

Nothing exists: zero hits for wallet/ACER/ACEG/balance/ledger/blink in the codebase; Stripe is only the frozen 50 PLN legacy team checkout. This is ТЗ module 2.6 — the largest item in the email by an order of magnitude. Proposal: **do not start implementation until a short product spec is agreed**; then build off-chain first.

Open questions for the client (blockers):
- Tokenomics: ACER↔PLN price, accrual amounts per source (participation, prizes, referral income per ТЗ 2.6.3), ACE(PL)↔ACER↔ACEG conversion rules.
- On-chain vs off-chain: ТЗ mentions Polygon/WalletConnect; recommendation is an **off-chain append-only ledger** first (fast, auditable, reversible), with on-chain export later.
- "Blink" — confirm which provider is meant (Blink the Bitcoin Lightning API?) and whether it's launch-critical or Stripe-first suffices.
- Legal: selling ACER for fiat may trigger e-money/MiCA obligations in PL/EU — the client should confirm the legal wrapper before we ship purchase.

Proposed phases once specced:
- **A. Ledger + balances (M/L)**: `wallet_transactions` append-only table (userId, asset enum ACER/ACE_PL/ACEG, amount, kind, reference, createdAt), balances derived by sum (materialized per-user later if needed); accrual hooks for check-in participation and referral events; cabinet Wallet page (balances + history per ТЗ 2.6.4 attributes); admin manual credit/debit with audit.
- **B. Buy ACER via Stripe (M)**: new checkout with `metadata.kind = "acer_purchase"` branch in the existing webhook (legacy path untouched — same pattern as the event-registration plan), credit ledger on `checkout.session.completed`, idempotent by session id. Payouts/withdrawals ("вывод") explicitly out of scope for v1.
- **C. Blink integration, conversions, staking, DAO (later)**: separate PRDs; depends on A+B and client answers.

## 7. Aug-29 participants (кто эти люди?) — answered + cleanup slice

Two sources, no mystery:
1. **Test debris**: 8 registrations under `uifix-1..8@example.invalid` + 9 draft heats on `mile-2026-08-29`, left by a 2026-07-28 `scripts/seed-heats-fixture.ts` session that never ran `--teardown` (already documented in the phase log, line 171). These are the suspicious "participants".
2. **Real registrations**: `mile-2026-08-29` is `registration_open` (`registry.ts:76`), so normal sign-ups, guest registrations, and admin-registers land there legitimately.

Cleanup slice (S):
1. Run `seed-heats-fixture.ts --teardown` (or targeted delete) against prod for the `@example.invalid` rows + draft heats; verify roster afterwards.
2. Produce the client a list of remaining genuine Aug-29 registrations (name, email, source, date) from `/admin/events/mile-2026-08-29`.
3. Guardrail: fixture/verify scripts (`seed-heats-fixture`, `verify-results-import`, `verify-results-seeding`, `verify-heat-publish`, `verify-race-morning`) insert directly into live tables — add a refuse-unless-`ALLOW_FIXTURES=1`/non-prod-DATABASE_URL check so this never recurs.

## 8. Client analytics (участия, персональные рейтинги) — 🟡 unify + extend

Exists today: profile shows races / best time / per-result AB-mile level 1–16 + full results section; admin users list shows Aug regs + races-run counts; admin user detail shows unioned event history (no counts, no times). Landing "All" results tab is cross-event but **per result row** — one runner in two races appears twice, no person-level aggregation.

Slice (M):
1. **One definition of "races participated"**: currently three disagreeing definitions (profile = non-cancelled registrations; admin list = checked-in + legacy; referral stats = checked-in only, no legacy). Decide (recommended: `checked_in` + legacy attended) and apply everywhere.
2. Admin user detail: add races/best-time/level summary + per-event results (reuse `findUserResults`).
3. **Person-level leaderboard**: aggregate results by registration/name-key — best time per person (or simple points), dedupe the landing "All" tab; this is the "персональные рейтинги" ask. A true season-points system is a product decision — propose best-time ranking v1.
4. Optional admin analytics page: participation funnel per event (registered → checked-in → finished), repeat-participation cohort counts.

## 9. Duplicate user detection (по email, phone; пример Marcin Hildebrand) — 🔴 new

Entirely absent today: email is unique at DB level but only case-normalized by convention (no `lower(email)` index); phone has no index, no uniqueness, and `normalizePhone()` produces a display string, not a dedup key. Building blocks exist: `libphonenumber-js` (`src/lib/phone.ts`) for E.164, `nameKey()` (`src/lib/events/name-key.ts`) for normalized names.

Slice (M):
1. Keys: store/compute E.164 phone alongside display form; add a `lower(email)` unique safety index (verify no case-variant dupes exist first).
2. **Admin duplicates report** (`/admin/users/duplicates` or a section on `/admin/users`): groups by E.164 phone, by lower(email) near-misses, and by `nameKey()+DOB`; each group links to the user detail pages. Start with the Marcin Hildebrand case as the acceptance example.
3. Registration-time guard: on guest registration and admin-register, warn when the phone already belongs to another account (block or flag — ask client which).
4. Later (only if the report shows real volume): assisted merge tool (re-point registrations/results/referrals, delete loser) — deliberately not v1; manual resolution via existing delete/admin-register is enough at current scale.

## Task breakdown (one file per agent)

The work above is split into 15 self-contained task files in `planning/admin-cabinet-tasks/` — see its `README.md` for the dependency table. Hand one file to one agent; each carries its own context, file refs, and acceptance criteria.

## Suggested order

1. **Week 1 — quick wins & answers (all S)**: §7 Aug-29 cleanup + participant list for the client; §1 Google sign-in live verification; §4 users-list fixes (sort, pagination, phone, confirmed-profile stat); §3 nav capability filtering.
2. **Week 2 — race-ops & data quality (M)**: §5 volunteer scan hardening (before the Aug 22/29 race mornings if possible — at minimum items 1–2 and volunteer accounts); §9 duplicates report + registration guard.
3. **Week 3 — analytics (M)**: §8 unified participation definition, admin detail stats, person-level leaderboard; §2 referral polish alongside (same definitions).
4. **Parallel — §6 wallet spec**: send the client the open questions now; schema/Stripe work starts only after answers. Rough build estimate once specced: A ≈ 1–1.5 wk, B ≈ 0.5–1 wk.

## Questions to send the client

1. "Подтвержденные профили" = email-verified or fully-filled profile (имя, фамилия, дата рождения, пол, телефон)? (§4)
2. Duplicates: warn-and-allow or hard-block a second account with the same phone? (§9)
3. Wallet: token prices/accrual amounts, conversion rules, Blink = which provider, off-chain ledger OK for v1, legal wrapper for selling ACER? Withdrawals in v1? (§6)
4. Personal rating: best-time ranking v1 acceptable, or a points-per-race season system? (§8)
5. Audit log of admin actions needed? (§3)
