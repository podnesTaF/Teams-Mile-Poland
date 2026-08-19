# Task 06 — Volunteer scan: signed-out affordance + scan-next loop

Size: M. Dependencies: none (do before the Aug 22 / Aug 29 race mornings).

## Background
The volunteer QR flow is built end to end: the ticket QR encodes the public page `/tickets/<registrationId>?s=<sig>` (`src/features/event-registration/ticket.ts:45-49`); that page renders an inline `TicketAdminPanel` (check-in with auto bib lease, waiting-list assign) when the viewer's session has the `checkin` capability (`src/app/[locale]/tickets/[registrationId]/page.tsx:86,137-147`); an in-app camera scanner lives at `/admin/scan` (`src/features/admin/components/checkin/ticket-scanner.tsx`, jsQR, pushes to `/tickets/<id>?s=<sig>#admin`). Two UX dead-ends remain:
1. **Signed-out scan**: a volunteer scanning with the native phone camera opens the public ticket in a browser with no admin session — the page renders nothing admin-related and no hint (page.tsx:86-147). They're stuck.
2. **No loop**: after a panel check-in, `resolveSurface` redirects back to the ticket page (`src/features/admin/checkin-actions.ts:160-164`); the volunteer must manually navigate to `/admin/scan` for the next runner.

## Steps
1. On `/tickets/[registrationId]`, when the ticket signature is valid but the viewer lacks the `checkin` capability, render a discreet staff affordance (small footer link, not runner-facing UI): "Staff sign-in" → `/auth/sign-in?redirectTo=/<locale>/tickets/<id>?s=<sig>%23admin`. Only server-side; keep the public ticket unchanged otherwise. i18n: this can stay English-only if placed as staff chrome, or add keys to the existing ticket namespace in pl/en/ua — follow whichever the page already does for admin-panel text (the panel is English-only).
2. After a successful check-in via `surface=ticket`, show a "Scan next runner" button on the ticket panel success state linking to `/admin/scan` (and keep the existing back-to-desk link, `ticket-admin-panel.tsx:63-65`).
3. Optional if trivial: in `ticket-scanner.tsx`, after `router.push`, ensure back-navigation returns to the scanner cleanly (history behavior), since the loop link partially addresses this.
4. Write a one-page volunteer instruction (markdown in `docs/` or `planning/`): sign in once on their phone → use `/admin/scan`, not the native camera; what the panel buttons do; who to call for bib conflicts.

## Acceptance
- Signed-out volunteer scanning a valid QR can reach sign-in and land back on the same ticket with the panel open.
- After checking a runner in from the panel, one tap returns to the scanner.
- Runner-facing ticket view unchanged for non-admins (visual diff of the page for a plain user).
- typecheck/lint/build pass in all three locales.
