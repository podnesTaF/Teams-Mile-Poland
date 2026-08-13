# Slice 1 — RaceResult results import

> **Status (2026-08-13): implemented.** Migration `0016_dark_gravity` applied to
> the live DB; `scripts/verify-results-import.ts` passes end-to-end (20/20).
> File-level deviations from the plan are minor: actions live in
> `src/features/admin/results-actions.ts` + `results-import/{parse,data}.ts`,
> readers in `src/lib/events/results-data.ts` (`getMergedResults`,
> `getResultsEventsWithDb`, `getDirectResultRefs`).

Goal: results flow `RaceResult export file → admin upload → event_results table →
profile + landing`, replacing the retype-a-TS-file-and-redeploy loop. Target:
usable for `mile-2026-08-15`.

Diagram analysis and constraints: [comment.md](comment.md).

## 1. Schema — `event_results`

New file `src/db/schema/event-results.ts`, exported from the barrel
`src/db/schema/index.ts`. Follows `event-heats.ts` conventions (event_slug text,
no FK to events — events are config).

```ts
export type ResultStatus = "finished" | "dnf" | "dns" | "dsq";

export const eventResults = pgTable(
  "event_results",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventSlug: text("event_slug").notNull(),
    /** 1-based heat number — the stable half of the (heat, bib) identity. */
    heatNumber: integer("heat_number").notNull(),
    bib: integer("bib").notNull(),
    /** text + $type, NOT a pgEnum (stranded-0012 lesson). */
    status: text("status").$type<ResultStatus>().notNull().default("finished"),
    /** Net time in hundredths of a second; null unless status = finished. */
    timeCs: integer("time_cs"),
    /** Finishing place within the heat; null unless status = finished. */
    place: integer("place"),
    /** Name exactly as the timing system recorded it. */
    name: text("name").notNull(),
    gender: text("gender").$type<"M" | "F">().notNull(),
    /**
     * Resolved deterministically at import time via the (heat, bib) lease —
     * registration whose heat's number and bib match the row. Never guessed:
     * left null when no unique lease resolves (manual timing edits, legacy
     * backfill). Read-time nameKey matching remains the fallback.
     */
    registrationId: uuid("registration_id").references(() => eventRegistrations.id, {
      onDelete: "set null",
    }),
    importedAt: timestamp("imported_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("event_results_event_heat_bib_uq").on(t.eventSlug, t.heatNumber, t.bib)],
);
```

Notes:

- `heatNumber` (not `heat_id`): matches the `(heat, bib)` identity rule of
  ADR 0003, survives heat-row deletion, and allows backfilling legacy events
  that have no `event_heats` rows.
- Migration via `npm run db:generate` → `0016_*`; auto `when` (current epoch ms)
  clears the live watermark `1785389147036` — verify in
  `src/db/migrations/meta/_journal.json` before `db:migrate`. Additive only.

## 2. Parser — `src/features/admin/results-import/parse.ts`

Input: the RaceResult export file, `.xlsx` (read with `exceljs`, already a dep)
or `.csv` (small hand parser with quoted-field support; no new dep).

Header row matched case-insensitively with aliases, so the operator's export
layout has slack:

| Field | Accepted headers | Notes |
|---|---|---|
| heat | `Heat`, `Contest`, `Race` | required, integer |
| bib | `Bib`, `BIB`, `No`, `Nr` | required, integer |
| place | `Place`, `Rank`, `Pos` | required when finished |
| name | `Name` or `Surname`+`First name` (either order — round-trip of our Flat sheet) | required |
| gender | `Sex`, `Gender`, `M/F` | `M`/`F` |
| time | `Time`, `Finish Time`, `Netto`, `Net Time` | `m:ss.hh`, `h:mm:ss.hh`, comma decimals → `timeCs` |
| status | `Status`, `Comment` (optional) | `DNF`/`DNS`/`DSQ`/empty; empty time + no status ⇒ reject row |

Output: `ParsedResults { heats: Map<number, ParsedRow[]>, errors: RowError[] }` —
per-row errors carry the source row number so the operator can fix the file.

Time contract with the operator (also in comment.md): export must include the
heat column; bib alone is ambiguous across heats.

## 3. Import action + matching — `src/features/admin/results-actions.ts`

Two server actions over one core, following `heat-actions.ts` / `action-helpers.ts`
(`requireAdmin`, flash `?ok=…&error=…` on the commit redirect):

- `previewResultsImport(eventSlug, formData)` — parse + resolve, return
  diagnostics, write nothing.
- `commitResultsImport(eventSlug, formData)` — same parse/resolve, then in one
  transaction: `DELETE FROM event_results WHERE event_slug = $1 AND heat_number
  IN (heats present in file)` + insert. **Replace-per-heat makes re-import
  idempotent** and is exactly the mid-event flow: import quals heat by heat,
  re-import a corrected heat, import finals after.

Resolution per row (deterministic, never guessed):

1. `(heat, bib)` lease: registration with `event_slug`, `bib = row.bib`, and
   `heat_id → event_heats.number = row.heat` — unique by construction,
   regardless of `bib_returned_at` (bibs are returned when a heat finishes, but
   the lease row keeps both values).
2. Fallback `nameKey(row.name)` against the event's roster (reuse
   `src/lib/events/name-key.ts`); only a unique match links.
3. Otherwise `registrationId = null` — imported, shown as "unlinked" in preview.

Preview diagnostics: per heat — rows, finishers, DNF/DNS/DSQ, linked/unlinked
counts, unparseable rows, plus warnings (heat number with no `event_heats` row,
duplicate `(heat, bib)` within the file ⇒ hard error, place gaps).

After commit: revalidate the public surfaces (landing + profile), following the
`revalidateStartList` precedent in `src/features/event-heats/start-list.ts`.

## 4. Admin UI — Results tab

- `src/features/admin/components/shell/event-tabs.tsx`: add
  `{ key: "results", label: "Results", segment: "results", suffix: "/results" }`.
- New route `src/app/[locale]/admin/events/[slug]/results/page.tsx` (inside the
  existing event layout; admin shell + `AdminEventTabs` come for free; 404 unless
  `eventType === "individual"`, like the export routes).
- Page: current state (rows per heat, imported-at, linked/unlinked counts) +
  upload card. Client component holds the chosen file, calls preview action,
  renders diagnostics, then commit re-sends the same file. No staged state to
  persist. English-only, per admin convention.

## 5. Readers — DB first, config fallback

New `src/lib/events/results-data.ts`:

```ts
/** DB rows (finishers only, mapped to ResultEntry) if any exist for the slug;
    otherwise the config sheet (event.results). */
export async function getEventResults(slug: string): Promise<EventResults | undefined>;
```

- **Landing** (`src/components/landing/landing-view.tsx` → `results.tsx`): where
  the server currently assembles results from `getResultsEvents()`, await
  `getEventResults` per completed event. Client component and row identity
  (`slug:heat:bib`) unchanged.
- **Profile** (`src/app/[locale]/profile/page.tsx` → `findUserResults`): keep
  `findUserResults` pure; change its input from "read registry config inside"
  to an injected `resultsBySlug: Map<string, EventResults>` the caller loads via
  `getEventResults`. For DB rows with a `registrationId`, short-circuit: link
  directly instead of nameKey matching (nameKey stays for legacy/unlinked rows).
  Rank/total/`computeLevel` logic unchanged.
- DNF/DNS/DSQ are stored but **not displayed** in slice 1 (public model stays
  finishers-only); display is a slice-2 decision.
- Legacy config sheets (`results/warsaw-2026.ts`, `results/mile-2026-08-01.ts`)
  stay as fallback. Optional follow-up: one-off backfill script → then delete
  the fallback path.

## 6. Verification (repo has no test runner — script pattern)

`scripts/verify-results-import.ts`, modeled on `verify-heat-export.ts` +
`seed-heats-fixture.ts`:

1. Seed fixture event heats + registrations with bib leases (**live DB — scope
   every delete to created ids**; no mail is sent on this path).
2. Build a sample RaceResult CSV and XLSX in memory (incl. DNF row, comma
   decimal time, surname-first name, an unknown bib).
3. Parse → assert row-level results; commit → assert DB rows, linking, and
   idempotent re-import (re-run commit, row count stable).
4. Assert `getEventResults` prefers DB and falls back to config for a legacy slug.
5. Cleanup by created ids.

Plus the standard `/verify` static gate (tsc/build/lint) and an admin HTTP pass
over `/admin/events/<slug>/results` via the temp-session pattern.

## Out of scope (slice 2/3)

- Seeding finals heats from imported qualification times (heat-builder bridge).
- Public live/provisional results route (dynamic rendering, not start-list caching).
- my.raceresult.com online poller + per-event `timing` config in the registry.
- Payment lane from the diagram — separate decision, not a timing concern.
