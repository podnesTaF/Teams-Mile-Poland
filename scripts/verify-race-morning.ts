/**
 * Throwaway DB round-trip for the race-morning slice (#32). NOT committed.
 *
 *   npx tsx --env-file=.env.local scripts/verify-race-morning.ts
 *   npx tsx --env-file=.env.local scripts/verify-race-morning.ts --teardown
 *
 * Runs against whatever `DATABASE_URL` `.env.local` points at, which is the live
 * DB (there is no Neon branch here). Every fixture lives on `mile-2026-08-15` —
 * an individual event with zero registrations and zero heats; the script refuses
 * to run if that changes, and every delete is scoped to ids it created.
 *
 * Nothing here imports a mail module: the race-morning path sends no email, so
 * there is no transport in the process at all.
 */
import { and, eq, inArray, like } from "drizzle-orm";

import { eventHeats, eventRegistrations, users } from "../src/db/schema";
import { getDb } from "../src/lib/db";
import {
  checkInWithBib,
  checkInWithoutBib,
  getEventRoster,
  getRegistrationEventSlug,
  holdsBib,
  leaseBibForCheckedIn,
  setRegistrationStatus,
  suggestNextBib,
} from "../src/features/admin/events-data";
import { awaitingBib } from "../src/features/admin/components/checkin/race-morning";
import {
  createHeats,
  findHeatWithRoom,
  finishHeatRow,
  getEventHeats,
  placeWalkUp,
  setHeatForRegistrations,
  unfinishHeatRow,
} from "../src/features/admin/heats-data";

const SLUG = "mile-2026-08-15";
const OTHER = "mile-2026-08-22";
const PREFIX = "rmv-";
const POOL_START = new Date("2026-08-15T08:15:00.000Z");

let pass = 0;
let fail = 0;

function check(label: string, ok: boolean, detail = "") {
  if (ok) {
    pass += 1;
    console.log(`  ok   ${label}`);
  } else {
    fail += 1;
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function eq_(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  check(label, a === e, `got ${a}, want ${e}`);
}

/**
 * Names and emails are deliberately digit-free: the desk search is a single
 * `ilike` over name/email plus an exact bib match, so a fixture called "Runner1"
 * would match a search for bib "1" by name and make the bib assertions lie.
 */
const PEOPLE = [
  { n: "1", first: "Alfa", last: "Aaa" },
  { n: "2", first: "Bravo", last: "Bbb" },
  { n: "3", first: "Charlie", last: "Ccc" },
  { n: "4", first: "Delta", last: "Ddd" },
  { n: "5", first: "Echo", last: "Eee" },
  { n: "6", first: "Foxtrot", last: "Fff" },
].map((p) => ({
  id: `${PREFIX}${p.n}`,
  first: p.first,
  last: p.last,
  email: `${p.first.toLowerCase()}.${PREFIX.replace("-", "")}@example.invalid`,
}));

async function teardown(quiet = false) {
  const db = getDb();
  const rows = await db.select({ id: users.id }).from(users).where(like(users.id, `${PREFIX}%`));
  const ids = rows.map((r) => r.id);
  if (ids.length > 0) {
    await db.delete(eventRegistrations).where(inArray(eventRegistrations.userId, ids));
  }
  for (const slug of [SLUG, OTHER]) {
    const heats = await db
      .select({ id: eventHeats.id })
      .from(eventHeats)
      .where(eq(eventHeats.eventSlug, slug));
    if (heats.length > 0) {
      await db.delete(eventHeats).where(
        inArray(
          eventHeats.id,
          heats.map((h) => h.id),
        ),
      );
    }
  }
  if (ids.length > 0) await db.delete(users).where(inArray(users.id, ids));
  if (!quiet) console.log(`removed ${ids.length} fixture users and the heats on ${SLUG}/${OTHER}`);
}

async function regIds(): Promise<Map<string, string>> {
  const rows = await getDb()
    .select({ id: eventRegistrations.id, userId: eventRegistrations.userId })
    .from(eventRegistrations)
    .where(
      and(eq(eventRegistrations.eventSlug, SLUG), like(eventRegistrations.userId, `${PREFIX}%`)),
    );
  return new Map(rows.map((r) => [r.userId, r.id]));
}

async function regRow(id: string) {
  const [row] = await getDb()
    .select({
      status: eventRegistrations.status,
      bib: eventRegistrations.bib,
      bibReturnedAt: eventRegistrations.bibReturnedAt,
      heatId: eventRegistrations.heatId,
      checkedInAt: eventRegistrations.checkedInAt,
    })
    .from(eventRegistrations)
    .where(eq(eventRegistrations.id, id))
    .limit(1);
  return row;
}

async function run() {
  const db = getDb();

  /* ── 0. preconditions ─────────────────────────────────────────────── */
  console.log("\n0. preconditions");
  for (const slug of [SLUG, OTHER]) {
    const regs = await db
      .select({ id: eventRegistrations.id })
      .from(eventRegistrations)
      .where(eq(eventRegistrations.eventSlug, slug));
    const heats = await getEventHeats(slug);
    if (regs.length > 0 || heats.length > 0) {
      console.error(
        `${slug} already holds ${regs.length} registrations and ${heats.length} heats — run --teardown first.`,
      );
      process.exit(1);
    }
  }
  console.log(`  ok   ${SLUG} and ${OTHER} are empty`);

  /* ── 1. fixtures ──────────────────────────────────────────────────── */
  console.log("\n1. fixtures");
  await db.insert(users).values(
    PEOPLE.map((p) => ({
      id: p.id,
      name: `${p.first} ${p.last}`,
      firstName: p.first,
      lastName: p.last,
      email: p.email,
      emailVerified: true,
      club: "Fixture AC",
      sex: "M" as const,
    })),
  );
  await db.insert(eventRegistrations).values(
    PEOPLE.map((p) => ({
      eventSlug: SLUG,
      userId: p.id,
      status: "confirmed" as const,
      terms: true,
      locale: "pl",
    })),
  );
  // Three heats of two, ten minutes apart. Two get published; heat 3 stays draft.
  await createHeats(SLUG, {
    count: 3,
    capacity: 2,
    firstStart: POOL_START,
    intervalMinutes: 10,
  });
  // A heat on another event, to prove slug scoping.
  await createHeats(OTHER, {
    count: 1,
    capacity: 2,
    firstStart: POOL_START,
    intervalMinutes: 10,
  });

  const heats0 = await getEventHeats(SLUG);
  eq_("three heats created", heats0.length, 3);
  const [H1, H2] = heats0;
  await db
    .update(eventHeats)
    .set({ publishedAt: new Date() })
    .where(inArray(eventHeats.id, [H1.id, H2.id]));
  const otherHeat = (await getEventHeats(OTHER))[0];

  const reg = await regIds();
  const R = (n: string) => reg.get(`${PREFIX}${n}`) as string;
  eq_("six registrations created", reg.size, 6);
  eq_("bibsHeld starts at zero", (await getEventHeats(SLUG)).map((h) => h.bibsHeld), [0, 0, 0]);

  /* ── 2. seeding + leases ──────────────────────────────────────────── */
  console.log("\n2. seeding and leases");
  await setHeatForRegistrations(SLUG, H1.id, [R("1"), R("2")]);
  await setHeatForRegistrations(SLUG, H2.id, [R("3")]);
  await checkInWithBib(R("1"), 1);
  await checkInWithBib(R("2"), 2);
  await checkInWithBib(R("3"), 3);

  const heats1 = await getEventHeats(SLUG);
  eq_("fill per heat", heats1.map((h) => h.fill), [2, 1, 0]);
  eq_("bibsHeld per heat", heats1.map((h) => h.bibsHeld), [2, 1, 0]);
  eq_("states", heats1.map((h) => h.state), ["published", "published", "draft"]);
  eq_("lowest free bib is 4", await suggestNextBib(SLUG), 4);

  /* ── 3. walk-up placement ─────────────────────────────────────────── */
  console.log("\n3. walk-ups");
  eq_("room goes to the earliest published heat with a lane", await findHeatWithRoom(SLUG), {
    id: H2.id,
    number: 2,
  });

  eq_("walk-up seeds into heat 2", await placeWalkUp(SLUG, R("4")), {
    placed: true,
    heatNumber: 2,
  });
  eq_("…and the row really moved", (await regRow(R("4")))?.heatId, H2.id);

  eq_("no published heat has room now — Unplaced", await placeWalkUp(SLUG, R("5")), {
    placed: false,
    reason: "no-room",
  });
  eq_("the draft heat is never auto-filled", (await getEventHeats(SLUG))[2].fill, 0);
  eq_("a runner already on the card is left alone", await placeWalkUp(SLUG, R("1")), {
    placed: false,
    reason: "already-seeded",
  });
  eq_("…still in heat 1", (await regRow(R("1")))?.heatId, H1.id);
  eq_("cross-event id is refused", await placeWalkUp(OTHER, R("6")), {
    placed: false,
    reason: "already-seeded",
  });
  eq_("…and stays unseeded", (await regRow(R("6")))?.heatId, null);

  /* ── 4. bib-pending, then a freed number ──────────────────────────── */
  console.log("\n4. bib pending");
  await checkInWithoutBib(R("5"));
  const pendingAt = (await regRow(R("5")))?.checkedInAt ?? null;
  const checkedIn1 = await getEventRoster(SLUG, { status: "checked_in" });
  eq_("four runners checked in", checkedIn1.length, 4);
  eq_(
    "R5 is on the waiting list (checked in, no lease, heat not run)",
    checkedIn1.filter(awaitingBib).map((r) => r.name),
    ["Echo Eee"],
  );
  eq_(
    "R5 is Unplaced (checked in, no heat)",
    checkedIn1.filter((r) => r.heatId === null).map((r) => r.name),
    ["Echo Eee"],
  );
  eq_("checked-in runners carry their heat number",
    checkedIn1.find((r) => r.name === "Alfa Aaa")?.heatNumber, 1);

  eq_("a freed number can be handed over without re-stamping arrival",
    await leaseBibForCheckedIn(SLUG, R("5"), 4), true);
  const r5 = await regRow(R("5"));
  eq_("R5 now holds bib 4", [r5?.bib, r5?.bibReturnedAt], [4, null]);
  eq_("…and their check-in time did not move", r5?.checkedInAt?.getTime(), pendingAt?.getTime());
  eq_("a runner who is not checked in cannot be leased one",
    await leaseBibForCheckedIn(SLUG, R("6"), 5), false);
  eq_("…nor through another event's slug", await leaseBibForCheckedIn(OTHER, R("5"), 6), false);

  /* ── 4b. bib search finds the current holder, not past ones ───────── */
  console.log("\n4b. bib search");
  eq_(
    "searching a held bib finds its wearer",
    (await getEventRoster(SLUG, { q: "1" })).map((r) => r.name),
    ["Alfa Aaa"],
  );

  /* ── 5. finish returns the bibs ───────────────────────────────────── */
  console.log("\n5. finish");
  eq_("unknown heat", await finishHeatRow(SLUG, otherHeat.id), { result: "missing" });
  eq_("a draft heat cannot be finished", await finishHeatRow(SLUG, heats0[2].id), {
    result: "not-published",
  });
  eq_("heat 1 finished, two bibs back", await finishHeatRow(SLUG, H1.id), {
    result: "finished",
    returned: 2,
  });
  const heats2 = await getEventHeats(SLUG);
  eq_("heat 1 reads finished", heats2[0].state, "finished");
  eq_("its lanes are still filled", heats2[0].fill, 2);
  eq_("but it holds no bibs", heats2[0].bibsHeld, 0);
  eq_("bib 1 is the lowest free number again", await suggestNextBib(SLUG), 1);
  eq_("R1 keeps the number for the record", (await regRow(R("1")))?.bib, 1);
  eq_("finishing twice is refused", await finishHeatRow(SLUG, H1.id), { result: "already" });

  // The desk must not offer a freed number back to somebody who has just run.
  const afterFinish = await getEventRoster(SLUG, { status: "checked_in" });
  eq_(
    "runners of a finished heat are NOT on the waiting list",
    afterFinish.filter(awaitingBib).map((r) => r.name),
    [],
  );
  eq_(
    "…they are still checked in, holding nothing",
    afterFinish.filter((r) => !holdsBib(r)).map((r) => r.name).sort(),
    ["Alfa Aaa", "Bravo Bbb"],
  );
  eq_("…and cannot be handed a fresh bib", await leaseBibForCheckedIn(SLUG, R("1"), 1), false);
  eq_("…so bib 1 is still free", await suggestNextBib(SLUG), 1);
  eq_(
    "searching a returned bib no longer finds its old wearer",
    (await getEventRoster(SLUG, { q: "1" })).map((r) => r.name),
    [],
  );

  /* ── 6. un-finish ─────────────────────────────────────────────────── */
  console.log("\n6. un-finish");
  eq_("un-finishing an open heat is refused", await unfinishHeatRow(SLUG, H2.id), {
    result: "not-finished",
  });
  eq_("heat 1 re-opened, two bibs re-leased", await unfinishHeatRow(SLUG, H1.id), {
    result: "unfinished",
    released: 2,
  });
  const heats3 = await getEventHeats(SLUG);
  eq_("heat 1 is published again", heats3[0].state, "published");
  eq_("…holding its two bibs", heats3[0].bibsHeld, 2);
  eq_("bib 5 is the lowest free number", await suggestNextBib(SLUG), 5);

  /* ── 7. un-finish fails loudly after a re-lease ───────────────────── */
  console.log("\n7. un-finish after a re-lease");
  await finishHeatRow(SLUG, H1.id);
  await checkInWithBib(R("6"), 1); // somebody else takes the freed number
  eq_("R6 holds bib 1", (await regRow(R("6")))?.bib, 1);
  eq_("un-finish is refused and names the bib", await unfinishHeatRow(SLUG, H1.id), {
    result: "conflict",
    bibs: [1],
  });
  const heats4 = await getEventHeats(SLUG);
  eq_("nothing changed: heat 1 is still finished", heats4[0].state, "finished");
  eq_("…R1's bib is still returned", holdsBib((await regRow(R("1")))!), false);
  eq_("…and R6 still holds 1", holdsBib((await regRow(R("6")))!), true);

  /* ── 8. status changes release the lease ──────────────────────────── */
  console.log("\n8. reverting releases");
  eq_("R6 holds a lease before the revert", holdsBib((await regRow(R("6")))!), true);
  await setRegistrationStatus(R("6"), "no_show");
  const r6 = await regRow(R("6"));
  eq_("no-show releases the lease but keeps the number", [r6?.bib, r6?.bibReturnedAt !== null], [1, true]);
  eq_("bib 1 is free again", await suggestNextBib(SLUG), 1);

  eq_("un-finish now succeeds — the clash is gone", await unfinishHeatRow(SLUG, H1.id), {
    result: "unfinished",
    released: 2,
  });

  /* ── 9. only checked-in members are re-leased ─────────────────────── */
  console.log("\n9. un-finish skips members who left checked_in");
  await setRegistrationStatus(R("2"), "registered"); // deliberately released
  await finishHeatRow(SLUG, H1.id);
  eq_("only R1 is re-leased", await unfinishHeatRow(SLUG, H1.id), {
    result: "unfinished",
    released: 1,
  });
  eq_("R1 holds again", holdsBib((await regRow(R("1")))!), true);
  eq_("R2's deliberate release stands", holdsBib((await regRow(R("2")))!), false);

  /* ── 10. odds and ends ────────────────────────────────────────────── */
  console.log("\n10. odds and ends");
  eq_("registration resolves to its event", await getRegistrationEventSlug(R("1")), SLUG);
  eq_(
    "an unknown registration resolves to nothing",
    await getRegistrationEventSlug("00000000-0000-0000-0000-000000000000"),
    null,
  );
  eq_("a heat cannot be finished through another event's slug",
    await finishHeatRow(OTHER, H2.id), { result: "missing" });

  /* ── 11. isolation ───────────────────────────────────────────────── */
  console.log("\n11. live rows untouched");
  const live = await db
    .select({ id: eventRegistrations.id })
    .from(eventRegistrations)
    .where(eq(eventRegistrations.eventSlug, "mile-2026-08-01"));
  console.log(`  mile-2026-08-01 still reports ${live.length} registrations`);
  eq_("no heats leaked onto mile-2026-08-01", (await getEventHeats("mile-2026-08-01")).length, 0);
  eq_(
    "the other session's fixture on mile-2026-08-29 is untouched",
    (await getEventHeats("mile-2026-08-29")).length,
    9,
  );

  console.log(`\n${pass} passed, ${fail} failed`);
}

async function main() {
  if (process.argv.includes("--teardown")) {
    await teardown();
    process.exit(0);
  }
  try {
    await run();
  } finally {
    console.log("\ncleaning up…");
    await teardown(true);
  }
  process.exit(fail === 0 ? 0 : 1);
}

void main();
