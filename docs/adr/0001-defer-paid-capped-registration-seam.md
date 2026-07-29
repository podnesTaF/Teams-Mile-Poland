# Defer the paid/capped registration path, but keep the seam

**Context.** The individual mile series ships with **free, uncapped** registration:
`registerForEvent` / `registerAsGuest` both call `createFreeRegistration`, and four
in-code comments plus the registry state "free and uncapped". A paid/capped path was
previously prototyped (a 30-free/20-paid slot counter + Stripe checkout) and removed
in favour of "all free". The `pending_registrations` table (holds a form payload +
`stripe_session_id` during Stripe checkout) is the surviving fragment of that path.

**Decision.** Paid/capped registration is **deferred, not dropped**. `pending_registrations`
is retained deliberately as the intake seam for a future paid flow — **do not delete it
as dead code**, and do not re-add a slot-counter table for the free flow.

**Consequences.** The seam is intentionally incomplete and must not be mistaken for a
working paid flow: `event_registrations` has **no payment reference, amount, or
free-vs-paid flag**, and there is **no capacity/cap field** on the event config or in the
DB. Completing the paid flow is
its own future design session (own grilling → PRD); it will need at minimum a payment
reference on the registration row and a per-event cap in the registry.
