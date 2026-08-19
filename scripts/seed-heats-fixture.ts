/**
 * Throwaway UI fixture for the heat builder (#29). NOT committed — delete when done.
 *
 * Creates 8 confirmed fixture runners on `mile-2026-08-29` (the event with zero
 * real registrations) so the builder's multiselect, fill-vs-capacity pills and
 * Unassigned column have something to show. It creates no heats — press
 * "Generate" on the page to do that, which is the thing worth watching.
 *
 *   ALLOW_FIXTURES=1 npx tsx --env-file=.env.local scripts/seed-heats-fixture.ts
 *   ALLOW_FIXTURES=1 npx tsx --env-file=.env.local scripts/seed-heats-fixture.ts --teardown
 *
 * Both modes write to the live DB, so both refuse to run without
 * `ALLOW_FIXTURES=1` (see `scripts/lib/guard.ts`).
 *
 * Teardown deletes only what this script created: the `uifix-*` users, their
 * registrations, and any heats on `mile-2026-08-29`. Nothing else is touched.
 */
import { eq, inArray, like } from "drizzle-orm";

import { eventHeats, eventRegistrations, users } from "../src/db/schema";
import { getDb } from "../src/lib/db";
import { requireFixtureConsent } from "./lib/guard";

requireFixtureConsent("scripts/seed-heats-fixture.ts");

const SLUG = "mile-2026-08-29";
const PREFIX = "uifix-";

const PEOPLE: Array<{ first: string; last: string; sex: "M" | "F"; club: string }> = [
  { first: "Ola", last: "Adamczyk", sex: "F", club: "AZS Warszawa" },
  { first: "Bartek", last: "Brzozowski", sex: "M", club: "AZS Warszawa" },
  { first: "Celina", last: "Cieślak", sex: "F", club: "Legia" },
  { first: "Damian", last: "Dąbrowski", sex: "M", club: "Legia" },
  { first: "Ewa", last: "Ejsmont", sex: "F", club: "Sokół" },
  { first: "Filip", last: "Frankowski", sex: "M", club: "Sokół" },
  { first: "Gosia", last: "Górska", sex: "F", club: "" },
  { first: "Henryk", last: "Hoffman", sex: "M", club: "" },
];

async function teardown() {
  const db = getDb();
  const fixtureUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(like(users.id, `${PREFIX}%`));
  const ids = fixtureUsers.map((u) => u.id);

  if (ids.length > 0) {
    await db.delete(eventRegistrations).where(inArray(eventRegistrations.userId, ids));
  }
  const heats = await db
    .select({ id: eventHeats.id })
    .from(eventHeats)
    .where(eq(eventHeats.eventSlug, SLUG));
  if (heats.length > 0) {
    await db.delete(eventHeats).where(
      inArray(
        eventHeats.id,
        heats.map((h) => h.id),
      ),
    );
  }
  if (ids.length > 0) {
    await db.delete(users).where(inArray(users.id, ids));
  }
  console.log(`removed ${ids.length} fixture users, their registrations, and ${heats.length} heats on ${SLUG}`);
}

async function seed() {
  const db = getDb();

  const existing = await db
    .select({ id: eventRegistrations.id })
    .from(eventRegistrations)
    .where(eq(eventRegistrations.eventSlug, SLUG));
  if (existing.length > 0) {
    console.log(`${SLUG} already has ${existing.length} registrations — run --teardown first.`);
    process.exit(1);
  }

  await db.insert(users).values(
    PEOPLE.map((p, i) => ({
      id: `${PREFIX}${i + 1}`,
      name: `${p.first} ${p.last}`,
      firstName: p.first,
      lastName: p.last,
      email: `${PREFIX}${i + 1}@example.invalid`,
      sex: p.sex,
      club: p.club || null,
    })),
  );
  await db.insert(eventRegistrations).values(
    PEOPLE.map((_, i) => ({
      eventSlug: SLUG,
      userId: `${PREFIX}${i + 1}`,
      status: "confirmed" as const,
      confirmedAt: new Date(),
      terms: true,
    })),
  );

  console.log(`seeded ${PEOPLE.length} confirmed runners on ${SLUG}`);
  console.log("open http://localhost:3001/admin/events/mile-2026-08-29/heats");
}

async function main() {
  if (process.argv.includes("--teardown")) await teardown();
  else await seed();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
