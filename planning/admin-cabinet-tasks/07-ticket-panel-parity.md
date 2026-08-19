# Task 07 — TicketAdminPanel parity: custom bib entry + no-show/undo

Size: S/M. Dependencies: none (best after task 06 to avoid merge friction in the same files).

## Background
The inline check-in panel on the scanned ticket (`src/features/admin/components/ticket-admin-panel.tsx`) only offers auto-lease "Check in" (`:120-131`) and waiting-list "Assign bib N" (`:107-118`). Typing a specific bib (runner already has one pinned on) and no-show/undo require bouncing to the desk — the panel's own copy says so (`:105`, `:136`). The desk already has all of it: bib input in `src/features/admin/components/checkin/runner-card.tsx:111`, actions `assignBibAndCheckIn` (`src/features/admin/checkin-actions.ts:193`, validates 1..`getBibPool(slug)`, `error=bib_held` on conflict), `markNoShow` (`:345`), `revertToRegistered` (`:357`). The actions already support `surface=ticket` via `resolveSurface` (`checkin-actions.ts:134-177`) which re-verifies the signature and rebuilds the return URL server-side — extend usage, don't re-invent.

## Steps
1. Add an optional bib input to the panel's not-checked-in state, pre-filled with the leased/suggested bib, posting the existing `assignBibAndCheckIn` with `surface=ticket` + `sig` (mirror the desk's `runner-card.tsx` form fields).
2. Add "Mark no-show" (registered state) and "Undo check-in" / "Undo no-show" (respective states) buttons posting `markNoShow` / `revertToRegistered` — these actions currently may not accept the ticket surface; if so, route them through `resolveSurface` the same way `assignBibAndCheckIn` does.
3. Keep destructive-ish actions behind the existing confirm idiom (`ConfirmSubmit`) as the desk does.
4. Update the panel copy that currently tells the volunteer to go to the desk.

## Acceptance
- From a scanned ticket, a volunteer can: check in with a typed bib (conflict shows the `bib_held` flash on the ticket page), mark no-show, and undo — without visiting the desk.
- Desk flows unchanged.
- typecheck/lint/build pass.
