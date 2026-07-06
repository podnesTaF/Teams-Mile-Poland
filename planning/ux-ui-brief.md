# UX/UI Brief — Mile Series update (consistency pass)

The site's design is already done. This is an **update**: a set of new flows was added
for the individual mile series. Your job is to make these new flows **consistent with
the existing site** — same visual language, patterns, spacing, states, and tone — so
they don't read as bolted-on.

Below are the **new flows** (described as journeys, not screens). Align each with how
the rest of the site already does things.

## Flow 1 — Discover & pick a race
A series of 5 race nights. Some are open for registration, some "open soon," some may
be full or past. The visitor needs to take in the whole series and zero in on one date,
seeing how full it is (free vs paid slots left). States: open · opens-soon · full ·
closed · completed.

## Flow 2 — Account & verification
Sign up (email+password or Google), then verify email before registering — so there's a
"check your inbox" waiting state and a "resend" path. Plus sign in, forgot/reset
password, and the case where someone acts while still unverified.

## Flow 3 — Complete profile
A gate: you can't register until profile details are filled. Reached proactively (visit
profile) or reactively (bounced here mid-registration, then returned to finish). The
round-trip back to registering should feel seamless.

## Flow 4 — Register for a race
Two lanes that converge: free early slots (instant ticket) and, once those are gone,
a small paid slot via card checkout (register → pay → return → ticket). Before
confirming, the commitment is clear (date, time, venue, cost, terms). States: success
(free), success (paid) with a brief "preparing your ticket" return moment, payment
cancelled, already-registered, sold-out mid-flow, and blocked (not signed in / not
verified / profile incomplete) each routing to the right fix and back.

## Flow 5 — Ticket
A QR the runner shows at the stadium; bib is assigned later at check-in (so "bib:
assigned at check-in" becomes a real number). Reached after registering, from a
confirmation email, and from a "my registrations" list. States: not-checked-in vs
checked-in.

## Flow 6 — Lifecycle emails
A per-race reminder chain (a week out, few days out, day before, morning of) with
when/where and quick actions (calendar, ticket, directions), in the runner's language,
on-brand with the rest of the site's emails.

## Flow 7 — Staff check-in & roster
Race-day tool: find a runner by QR scan or search (name/email/bib), assign a bib
(suggested, overridable), check in / mark no-show / undo. Error states from a real
queue: bib taken, invalid QR, not found, already checked in. Plus a roster view with
status filters, counts, and export — align these with the existing admin patterns.

## The task
Review these new flows against the established design system and make them consistent —
call out and fix anywhere they diverge from existing patterns, states, or tone.
