# Passwordless guest registration is the canonical logged-out path

**Context.** The cross-cutting checklist's auth-gating pattern funnels a logged-out user
through the gate chain `guest → /auth/sign-up?redirectTo → verify-email → profile →
action`. Event registration deliberately does **not** follow this for logged-out
visitors — but it **must** still guarantee that no ticket or registration exists for an
unconfirmed email, and that repeat submissions can't create duplicate participants.

**Decision.** A logged-out visitor registers **passwordlessly but email-verification-gated**:

1. The guest form collects the runner profile and creates an **unverified** `users`
   account (`emailVerified: false`) — **no registration row yet**.
2. Better Auth sends its verification email (reusing the configured
   `requireEmailVerification` / `sendOnSignUp` / `autoSignInAfterVerification`), carrying
   `redirectTo=/events/[slug]/register`.
3. Clicking the link verifies the email, auto-signs them in, and returns them to the
   register page, which **then** creates the registration and sends the ticket email.
4. The set-password link rides **inside the ticket email** (passwordless preserved; a
   password is only needed for a later fresh sign-in, never to get the ticket).

Existing **verified** email → bounced to sign-in. Existing **unverified** email (a repeat
submission) → **idempotent resend**: refresh the stored profile fields and re-send the
verification link; never create a second account or registration.

**Why.** Conversion matters for a free community event — one form, no separate sign-up
screen, no password — but that must not come at the cost of unconfirmed or duplicate
participants. Deferring the registration + ticket until after Better Auth verification
gives both: low friction *and* a hard email-confirmation gate, with no new verification
machinery (the auth stack is already configured for required verification).

**Consequences.**
- **Invariant:** an `event_registrations` row always corresponds to a **verified** email.
  Nothing is registered before confirmation; unverified accounts are leads, not participants.
- Repeat submissions collapse to a resend — duplicates are impossible (unique
  `users.email` + unique `(event_slug, user_id)` + registration-only-after-verify).
- **Phone is not required to register.** The participant-required set is
  `firstName, lastName, dateOfBirth, sex` (club + phone optional). `isProfileComplete`'s
  phone requirement is relaxed for the event gate so the guest and signed-in bars match
  and a verified guest auto-registers on return with no phone wall.
- Two transactional emails on the guest path: the verification email, then the
  ticket email (which carries the set-password CTA).
- Do **not** "fix" this back to force-setting `emailVerified: true`, nor to the full
  sign-up gate chain — the passwordless-but-verified shape is intentional.

**Amendment (2026-08-03).** Phone is now **required** to register, superseding the
"phone is not required" consequence above: the guest form and account sign-up both
collect it (via the country-dial-code `PhoneField`), `registerAsGuest` persists it, and
`canRegister` now equals `isProfileComplete` (adds `phone` to the gate). A verified
guest still auto-registers on return — the phone was captured on the form, so no wall
is hit. Legacy phone-less accounts are prompted through the profile form on their next
registration. The passwordless + email-verification-gated shape is unchanged.
