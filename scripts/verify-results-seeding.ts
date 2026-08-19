/**
 * Round-trip verification for slice 2 of the timing integration: the
 * qualification → final bridge (`topQualifiers` / `seedTopQualifiers`) and the
 * public per-event results projection (`getPublicResults`).
 *
 *   ALLOW_FIXTURES=1 npx tsx --env-file=.env.local scripts/verify-results-seeding.ts
 *
 * It refuses to run without `ALLOW_FIXTURES=1` (see `scripts/lib/guard.ts`).
 *
 * Runs against the live DB (no branch DB exists), so every row it creates is
 * prefixed / high-numbered and deleted by id at the end — including on failure.
 * It sends no email (nothing here imports a mailer; seeding is a heat move,
 * and notification only happens when an admin presses publish) and touches no
 * real registrations: fixture users are `seedfix-*`, fixture heats are 95–97
 * on the fixture event, and their bibs sit at the top of the pool (41+).
 */
import { and, eq, inArray } from "drizzle-orm";

import { eventHeats, eventRegistrations, eventResults, users } from "../src/db/schema";
import { seedTopQualifiers, topQualifiers } from "../src/features/admin/results-import/data";
import { getDb } from "../src/lib/db";
import { getEventBySlug } from "../src/lib/events/registry";
import { getPublicResults } from "../src/lib/events/results-data";
import { requireFixtureConsent } from "./lib/guard";

requireFixtureConsent("scripts/verify-results-seeding.ts");

const SLUG = "mile-2026-08-29";
const PREFIX = "seedfix-";
const QUAL_A = 95;
const QUAL_B = 96;
const FINAL = 97;

let failures = 0;
function check(label: string, ok: boolean, detail?: unknown) {
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${label}${ok || detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`,
  );
  if (!ok) failures += 1;
}

async function cleanup(heatIds: string[], userIds: string[]) {
  const db = getDb();
  await db
    .delete(eventResults)
    .where(
      and(
        eq(eventResults.eventSlug, SLUG),
        inArray(eventResults.heatNumber, [QUAL_A, QUAL_B, FINAL]),
      ),
    );
  if (userIds.length > 0) {
    await db.delete(eventRegistrations).where(inArray(eventRegistrations.userId, userIds));
    await db.delete(users).where(inArray(users.id, userIds));
  }
  if (heatIds.length > 0) {
    await db.delete(eventHeats).where(inArray(eventHeats.id, heatIds));
  }
}

async function main() {
  const db = getDb();
  check("fixture event exists in registry", Boolean(getEventBySlug(SLUG)));

  const heatIds: string[] = [];
  const userIds = ["alfa", "bravo", "charlie", "delta"].map((n) => `${PREFIX}${n}`);
  try {
    // ---- fixture: two qual heats, an empty final, four runners ----
    const heats = await db
      .insert(eventHeats)
      .values([
        { eventSlug: SLUG, number: QUAL_A, capacity: 10, scheduledAt: new Date() },
        { eventSlug: SLUG, number: QUAL_B, capacity: 10, scheduledAt: new Date() },
        { eventSlug: SLUG, number: FINAL, capacity: 10, scheduledAt: new Date() },
      ])
      .returning({ id: eventHeats.id, number: eventHeats.number });
    heatIds.push(...heats.map((h) => h.id));
    const heatId = (n: number) => heats.find((h) => h.number === n)!.id;

    await db.insert(users).values(
      userIds.map((id) => ({
        id,
        name: `Seedfix ${id}`,
        firstName: "Seedfix",
        lastName: id,
        email: `${id}@example.invalid`,
        sex: "M" as const,
      })),
    );
    const regs = await db
      .insert(eventRegistrations)
      .values([
        // Ran qual A on bib 41; also re-ran in qual B on bib 44 (timing mishap).
        {
          eventSlug: SLUG,
          userId: `${PREFIX}alfa`,
          status: "checked_in" as const,
          terms: true,
          heatId: heatId(QUAL_A),
          bib: 41,
          checkedInAt: new Date(),
        },
        {
          eventSlug: SLUG,
          userId: `${PREFIX}bravo`,
          status: "checked_in" as const,
          terms: true,
          heatId: heatId(QUAL_A),
          bib: 42,
          checkedInAt: new Date(),
        },
        {
          eventSlug: SLUG,
          userId: `${PREFIX}charlie`,
          status: "checked_in" as const,
          terms: true,
          heatId: heatId(QUAL_B),
          bib: 43,
          checkedInAt: new Date(),
        },
        {
          eventSlug: SLUG,
          userId: `${PREFIX}delta`,
          status: "checked_in" as const,
          terms: true,
          heatId: heatId(QUAL_B),
          bib: 44,
          checkedInAt: new Date(),
        },
      ])
      .returning({ id: eventRegistrations.id, userId: eventRegistrations.userId });
    const regId = (n: string) => regs.find((r) => r.userId === `${PREFIX}${n}`)!.id;

    // ---- imported results, straight into the table ----
    // Times: alfa 4:30.00 < charlie 4:35.00 < (unlinked) 4:40.00 < bravo 4:50.00.
    // Alfa's slower double in qual B must dedupe; delta's DNF and the row already
    // sitting in the final must never qualify.
    await db.insert(eventResults).values([
      { eventSlug: SLUG, heatNumber: QUAL_A, bib: 41, status: "finished" as const, timeCs: 27000, place: 1, name: "Seedfix alfa", gender: "M" as const, registrationId: regId("alfa") },
      { eventSlug: SLUG, heatNumber: QUAL_A, bib: 45, status: "finished" as const, timeCs: 28000, place: 2, name: "Unknown Walkup", gender: "M" as const, registrationId: null },
      { eventSlug: SLUG, heatNumber: QUAL_A, bib: 42, status: "finished" as const, timeCs: 29000, place: 3, name: "Seedfix bravo", gender: "M" as const, registrationId: regId("bravo") },
      { eventSlug: SLUG, heatNumber: QUAL_B, bib: 43, status: "finished" as const, timeCs: 27500, place: 1, name: "Seedfix charlie", gender: "M" as const, registrationId: regId("charlie") },
      { eventSlug: SLUG, heatNumber: QUAL_B, bib: 46, status: "finished" as const, timeCs: 27300, place: 2, name: "Seedfix alfa", gender: "M" as const, registrationId: regId("alfa") },
      { eventSlug: SLUG, heatNumber: QUAL_B, bib: 44, status: "dnf" as const, timeCs: null, place: null, name: "Seedfix delta", gender: "M" as const, registrationId: regId("delta") },
      { eventSlug: SLUG, heatNumber: FINAL, bib: 47, status: "finished" as const, timeCs: 24000, place: 1, name: "Should Never Qualify", gender: "M" as const, registrationId: null },
    ]);

    // ---- topQualifiers ----
    const top = await topQualifiers(SLUG, { limit: 4, excludeHeatNumbers: [FINAL] });
    check("top: 4 rows in time order", top.map((q) => q.timeCs).join() === "27000,27500,28000,29000", top.map((q) => q.timeCs));
    check("top: excludes the target heat's own results", top.every((q) => q.heatNumber !== FINAL));
    check("top: a double run qualifies once, on its best time", top.filter((q) => q.registrationId === regId("alfa")).length === 1 && top[0].timeCs === 27000);
    check("top: dnf never qualifies", top.every((q) => q.registrationId !== regId("delta")));
    check("top: unlinked row kept in the window, not skipped past", top[2].registrationId === null && top[2].name === "Unknown Walkup");
    const short = await topQualifiers(SLUG, { limit: 2, excludeHeatNumbers: [FINAL] });
    check("top: limit is a prefix of the same ordering", short.length === 2 && short[1].registrationId === regId("charlie"));

    // ---- seeding round-trip ----
    const seeded = await seedTopQualifiers(SLUG, heatId(FINAL), 4);
    check("seed: 3 linked seeded, 1 unlinked reported", seeded.outcome === "seeded" && seeded.seeded === 3 && seeded.unlinked === 1, seeded);
    const placed = await db
      .select({ userId: eventRegistrations.userId, heatId: eventRegistrations.heatId })
      .from(eventRegistrations)
      .where(inArray(eventRegistrations.userId, userIds));
    const inFinal = placed.filter((r) => r.heatId === heatId(FINAL)).map((r) => r.userId).sort();
    check(
      "seed: alfa, bravo, charlie moved into the final; delta left alone",
      inFinal.join() === [`${PREFIX}alfa`, `${PREFIX}bravo`, `${PREFIX}charlie`].join() &&
        placed.find((r) => r.userId === `${PREFIX}delta`)?.heatId === heatId(QUAL_B),
      placed,
    );
    const again = await seedTopQualifiers(SLUG, heatId(FINAL), 4);
    check("seed: re-seeding is idempotent", again.outcome === "seeded" && again.seeded === 3);
    const missing = await seedTopQualifiers(SLUG, "00000000-0000-0000-0000-000000000000", 4);
    check("seed: unknown heat refused", missing.outcome === "missing-heat");

    // ---- public projection ----
    const pub = await getPublicResults(SLUG);
    check("public: three heats, in order", pub?.heats.map((h) => h.number).join() === `${QUAL_A},${QUAL_B},${FINAL}`, pub?.heats.map((h) => h.number));
    const qualB = pub?.heats.find((h) => h.number === QUAL_B);
    check(
      "public: dnf shown, after the finishers",
      qualB?.rows.length === 3 && qualB.rows[2].status === "dnf" && qualB.rows[2].timeCs === null,
      qualB?.rows,
    );
    check(
      "public: finishers keep place order",
      qualB?.rows[0].place === 1 && qualB.rows[1].place === 2,
    );

    // ---- empty standings refuse rather than guess ----
    await db
      .delete(eventResults)
      .where(and(eq(eventResults.eventSlug, SLUG), inArray(eventResults.heatNumber, [QUAL_A, QUAL_B, FINAL])));
    const empty = await seedTopQualifiers(SLUG, heatId(FINAL), 4);
    check("seed: nothing imported → no-qualifiers, nothing moved", empty.outcome === "no-qualifiers");

    // Config fallback for a legacy sheet event is unaffected by any of this.
    const legacy = await getPublicResults("mile-2026-08-01");
    check("public: legacy event still resolves results", (legacy?.heats.length ?? 0) > 0);
  } finally {
    await cleanup(heatIds, userIds);
    console.log("cleanup: fixture rows removed");
  }

  console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
