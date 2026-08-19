# Task 05 — Capability-filter the admin nav + viewer sweep + stale artifact cleanup

Size: S. Dependencies: none.

## Background
Role model is fully shipped: `admin` / `admin_checkin` / `admin_viewer` with capabilities `view/edit/checkin` (`src/lib/auth/roles.ts:16-61`), enforced via `requireAdmin(locale, capability)` (`src/features/admin/action-helpers.ts:40-54`). But the sidebar `buildAdminNav` (`src/features/admin/components/shell/admin-nav.ts:68+`) shows every item to every role — an `admin_viewer` sees "Scan ticket" (gated `checkin` at `src/app/[locale]/admin/scan/page.tsx:23`) and gets a bare 404; same for edit-gated destinations.

## Steps
1. Pass the actor's role/capabilities into `buildAdminNav` and filter (or visibly disable) items the role can't use. Map: Scan ticket → `checkin`; Admins/Mailings/News mutations → pages render at `view` but decide per item whether a viewer should see them (they can view lists — keep view pages, drop `checkin`-only Scan for viewers, keep everything for `admin`). `admin_checkin` should keep: dashboard, events/check-in, scan; hide mailings/news/admins management if they'd 404.
2. Sweep view-gated pages for unhidden mutation controls for viewers: roster, heats, results import, mailings, admins, news. `users/page.tsx:222` and `admins/page.tsx:30` already gate with `userCan(actor, "edit")` — replicate that pattern where missing.
3. Stale artifact cleanup: remove/replace the `ADMIN_PASSWORD` mention in `planning/mile-series-plan.md:125`; remove the dead `tm_admin_session` cookie minting in `scripts/http-fixture.ts:89`; decide on the unused legacy `/api/ticket/check-in` route + `CHECKIN_API_KEY` (`src/app/api/ticket/check-in/route.ts`) — nothing in the app calls it; recommend deleting the route and documenting the removal, but check with owner if external hardware ever used it.

## Acceptance
- An `admin_viewer` session sees no nav item that 404s; an `admin_checkin` session sees check-in surfaces and nothing that 404s.
- No mutation buttons render for viewers on any admin page (verified by loading each page with a viewer session).
- Stale artifacts removed; typecheck/lint/build pass.
