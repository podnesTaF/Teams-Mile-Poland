# Bibs are recycled leases, not per-registration identities

**Context.** The RaceResult timing system in use provides a fixed pool of **50 physical
bibs** per event, while an event can field far more than 50 participants across its heats.
The original schema encoded the opposite assumption: `unique (event_slug, bib) where bib is
not null` — one bib, one registration, for the life of the event. Under that index the 51st
check-in of an event is impossible, and `assignBibAndCheckIn`'s auto-assign retry loop
exhausts and fails with "bib taken".

**Decision.** A bib is a **lease**. It is issued to a registration at check-in and returned
to the pool when that registration's heat is marked finished. The uniqueness constraint
becomes *"held by at most one runner at a time"*:

```
+ bib_returned_at  timestamptz null   on event_registrations
- unique (event_slug, bib) where bib is not null
+ unique (event_slug, bib) where bib is not null and bib_returned_at is null
```

The pool size lives in the **event registry config**, not the database — events are config
(see the cross-cutting checklist), and a different venue or timing setup has a different
count.

**Considered options.** A dedicated `event_bib_leases` history table was rejected: a
registration belongs to at most one heat and therefore holds at most one bib per event, so
the table would carry exactly one row per registration and buy nothing over a column.

**Consequences.**
- `bib` alone never identifies a result within an event — `(heat, bib)` does. The results
  model already nests entries inside heats, so it is unaffected.
- The retained `bib` value stays historically accurate after return: a runner who wore 12 in
  heat 1 still reads as 12 in heat 1 after 12 is re-leased in heat 5.
- Heat capacity is hard-capped at the pool size.
- When the pool is empty, **check-in must still succeed** with no bib ("bib pending"). A
  runner physically at the desk is never blocked by inventory; the admin frees bibs by
  marking a finished heat complete.
- Un-finishing a heat must fail loudly if a returned bib has since been re-leased, rather
  than silently creating two concurrent holders.
