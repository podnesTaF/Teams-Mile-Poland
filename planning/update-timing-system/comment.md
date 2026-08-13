# RaceResult timing integration — analysis of the diagrams

*Analyzed 2026-08-12 against the codebase. Implementation plan: [plan.md](plan.md).*

## What the diagrams show

**Flow diagram** (`WhatsApp Image 2026-08-10 at 10.16.58.jpeg`) — three lanes:

- **Payment systems**: registration payment to a bank account.
- **Ace Battle Mile (this platform)**: register/login → register to event → assign
  heat/start time → assign bib → send confirmation → DB with entries and results →
  participants check results. Timing operator exports the participant list from
  the system.
- **RaceResult**: import participants → process results during event → export
  results during/after event → import results (incl. qualification races) back
  into the platform DB.

**Hardware diagram** (`…10.42.20.jpeg`): RaceResult timing decoder feeding 4 loop
boxes / ground mats (1 red = finish, 3 black = splits or backup), a dedicated
RaceResult PC with a **GSM router** (trackside internet), LAN to an
operations-room PC driving an LED board.

**Equipment list** (`2026.08.12-список оборудование battle mile.xlsx`):
Decoder 5000S, Active Extension, 6× Active Loop Box v2, 2.4 GHz range extenders,
**50× ActivePro transponders** with straps. This is the RaceResult **Active**
system, driven by the RaceResult 12 desktop software. The 50 transponders match
the platform's 50-bib pool (ADR 0003).

## Coverage against the codebase

| Diagram step | Status in platform |
|---|---|
| Register in system / login | ✅ Better Auth + guest flow (ADR 0002) |
| Register to event | ✅ `src/features/event-registration/actions.ts` |
| Payment | ⚠️ **Discrepancy** — platform is free-and-uncapped; Stripe only wired for legacy team flow. Open question for the organizers. |
| Assign heat / start time | ✅ heat builder, `src/features/admin/heat-actions.ts` |
| Assign bib | ✅ bib leases at check-in (ADR 0003) |
| Send confirmation | ✅ ticket + heat-assignment emails (Resend) |
| Export participant list | ✅ `GET /api/admin/events/[slug]/heats/export` — the "Flat" sheet was built for RaceResult (`Heat \| Start \| Bib \| First name \| Surname \| Sex \| Club \| …`) |
| Import participants to RaceResult | ✅ manual (operator imports the XLSX) |
| Export results during/after event | ❌ **no counterpart** |
| Import results into platform DB | ❌ **no results table, no upload, no parser** — results today are hand-retyped TS config files (`src/lib/events/results/*.ts`) requiring a redeploy |
| Check results of the events | ⚠️ exists (landing + profile) but reads config, not DB — can't update during an event |

## Key constraints the integration must honor

1. **`(heat, bib)` identity** — bibs are recycled leases across heats within one
   event (ADR 0003). A results file keyed on bib alone silently mis-assigns
   across heats. Every ingested row must carry the heat number. The Flat export
   sheet already includes it, so a round-trip preserves the key.
2. **DNF/DNS/DSQ** have no representation in the current `ResultEntry` model;
   RaceResult will export them.
3. **Additive migrations only**, hand-check the journal `when` watermark, and
   **no new pgEnums** (stranded-0012 lesson — use `text` + `$type<>`).
4. The start-list page's static caching (revalidate only on publish/edit/finish)
   does not extend to anything that changes per finish.

## Recommended slices

- **Slice 1 (now, before mile-2026-08-15):** `event_results` table + admin
  Results tab with file upload (parse → preview with match diagnostics → commit,
  idempotent per heat) + point `findUserResults` and the landing results at the
  DB. Removes retype-and-redeploy. → [plan.md](plan.md)
- **Slice 2:** mid-event loop — seed finals heats from imported qualification
  times; public provisional-results view on a dynamic route.
- **Slice 3 (optional):** RaceResult 12 online forwarding to my.raceresult.com +
  a poller for live ingest (GSM router makes this feasible). Manual upload from
  slice 1 stays as the offline fallback.

## Operational note for the timing operator

Bibs are assigned at check-in on race morning, but RaceResult needs the
participant list beforehand. Either import the list without bibs the day before
and re-import the Flat sheet (with bibs) as heats close check-in, or agree a
fixed transponder-number ↔ bib mapping so RaceResult only ever needs
`(heat, bib)`. Settle this before the next event.
