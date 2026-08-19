/**
 * The body of the #30 verification — loaded only by `verify-heat-publish.ts`,
 * which blanks `RESEND_API_KEY` first. NOT committed.
 *
 * Runs against whatever `DATABASE_URL` `.env.local` points at, which is the live
 * DB (there is no Neon branch here). Every fixture lives on `mile-2026-08-22`,
 * the one individual event with zero registrations and zero heats; the script
 * refuses to run if that changes, and every delete is scoped to ids it created.
 * Both the seed and `--teardown` modes refuse to run at all without
 * `ALLOW_FIXTURES=1` (see `scripts/lib/guard.ts`).
 *
 * There is **no mail transport**, so `publishHeatsAndNotify` reports its whole
 * seeded set as `skipped`. The exact delta arithmetic is therefore asserted
 * through `getSeedPool`'s `notifyState`, which is the identical
 * {@link heatNotifyState} call the send loop filters on — the same rule, read
 * from the same rows, without a single message leaving the building.
 */
import { and, eq, inArray, like, sql } from "drizzle-orm";

import { eventEmailLog, eventHeats, eventRegistrations, users } from "../src/db/schema";
import { getDb } from "../src/lib/db";
import { resend } from "../src/lib/email";
import {
  createHeats,
  getEventHeats,
  getSeedPool,
  heatNotifyState,
  publishEventHeats,
  setHeatForRegistrations,
  updateHeatRow,
  type SeedRow,
} from "../src/features/admin/heats-data";
import { publishHeatsAndNotify } from "../src/features/event-mailings/heat-assignment";
import { requireFixtureConsent } from "./lib/guard";

// Named for the loader, since that is what an operator runs.
requireFixtureConsent("scripts/verify-heat-publish.ts");

if (resend !== null) {
  console.error("REFUSING TO RUN: a Resend client is configured — this script must not send mail.");
  process.exit(1);
}

const SLUG = "mile-2026-08-22";
const PREFIX = "hpv-";

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

const PEOPLE = [
  { id: `${PREFIX}1`, first: "Anna", last: "Aaa", status: "confirmed" as const },
  { id: `${PREFIX}2`, first: "Borys", last: "Bbb", status: "confirmed" as const },
  { id: `${PREFIX}3`, first: "Cela", last: "Ccc", status: "confirmed" as const },
  { id: `${PREFIX}4`, first: "Dawid", last: "Ddd", status: "no_show" as const },
  { id: `${PREFIX}5`, first: "Ewa", last: "Eee", status: "confirmed" as const },
];

async function teardown(quiet = false) {
  const db = getDb();
  const rows = await db.select({ id: users.id }).from(users).where(like(users.id, `${PREFIX}%`));
  const ids = rows.map((r) => r.id);

  if (ids.length > 0) {
    const regs = await db
      .select({ id: eventRegistrations.id })
      .from(eventRegistrations)
      .where(inArray(eventRegistrations.userId, ids));
    if (regs.length > 0) {
      await db.delete(eventEmailLog).where(
        inArray(
          eventEmailLog.eventRegistrationId,
          regs.map((r) => r.id),
        ),
      );
      await db.delete(eventRegistrations).where(inArray(eventRegistrations.userId, ids));
    }
  }
  // Heats on the fixture slug only — created by this script.
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
  if (ids.length > 0) await db.delete(users).where(inArray(users.id, ids));
  if (!quiet) {
    console.log(`removed ${ids.length} fixture users and ${heats.length} heats on ${SLUG}`);
  }
}

/** The UPDATE the send path runs on success — stands in for a delivery here. */
async function markNotified(registrationIds: string[]) {
  const db = getDb();
  for (const id of registrationIds) {
    const [row] = await db
      .select({ heatId: eventRegistrations.heatId, scheduledAt: eventHeats.scheduledAt })
      .from(eventRegistrations)
      .innerJoin(eventHeats, eq(eventRegistrations.heatId, eventHeats.id))
      .where(eq(eventRegistrations.id, id))
      .limit(1);
    if (!row?.heatId) throw new Error(`${id} is not seeded`);
    await db
      .update(eventRegistrations)
      .set({ notifiedHeatId: row.heatId, notifiedHeatTime: row.scheduledAt })
      .where(eq(eventRegistrations.id, id));
  }
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

async function notifiedCols(id: string) {
  const [row] = await getDb()
    .select({
      notifiedHeatId: eventRegistrations.notifiedHeatId,
      notifiedHeatTime: eventRegistrations.notifiedHeatTime,
    })
    .from(eventRegistrations)
    .where(eq(eventRegistrations.id, id))
    .limit(1);
  return row;
}

/** The set publish would mail: seeded, still coming, and not already current. */
function due(pool: SeedRow[]): SeedRow[] {
  return pool.filter(
    (p) => p.heatId && p.status !== "no_show" && p.notifyState !== "notified",
  );
}

async function run() {
  const db = getDb();

  /* ── 0. preconditions ─────────────────────────────────────────────── */
  console.log("\n0. preconditions");
  const kinds = await db.execute(
    sql`select unnest(enum_range(null::event_email_kind))::text as v`,
  );
  const kindValues = ((kinds as unknown as { rows?: { v: string }[] }).rows ?? (kinds as unknown as { v: string }[])).map(
    (r) => r.v,
  );
  check(
    "migration 0014 applied — 'heat_assignment' is a live enum value",
    kindValues.includes("heat_assignment"),
    kindValues.join(", "),
  );

  const existingRegs = await db
    .select({ id: eventRegistrations.id })
    .from(eventRegistrations)
    .where(eq(eventRegistrations.eventSlug, SLUG));
  const existingHeats = await getEventHeats(SLUG);
  if (existingRegs.length > 0 || existingHeats.length > 0) {
    console.error(
      `${SLUG} already holds ${existingRegs.length} registrations and ${existingHeats.length} heats — run --teardown first.`,
    );
    process.exit(1);
  }
  check(`${SLUG} is empty`, true);
  check("no mail transport configured", resend === null);

  /* ── 1. fixtures ──────────────────────────────────────────────────── */
  console.log("\n1. fixtures");
  await db.insert(users).values(
    PEOPLE.map((p) => ({
      id: p.id,
      name: `${p.first} ${p.last}`,
      firstName: p.first,
      lastName: p.last,
      email: `${p.id}@example.invalid`,
    })),
  );
  await db.insert(eventRegistrations).values(
    PEOPLE.map((p) => ({
      eventSlug: SLUG,
      userId: p.id,
      status: p.status,
      confirmedAt: p.status === "confirmed" ? new Date() : null,
      terms: true,
      locale: "pl",
    })),
  );
  const R = await regIds();
  const id = (n: number) => R.get(`${PREFIX}${n}`)!;
  eq_("5 fixture registrations", R.size, 5);

  const firstStart = new Date("2026-08-22T08:00:00.000Z"); // 10:00 Warsaw
  eq_(
    "2 heats created",
    await createHeats(SLUG, { count: 2, capacity: 12, firstStart, intervalMinutes: 10 }),
    2,
  );
  let heats = await getEventHeats(SLUG);
  eq_(
    "both heats draft",
    heats.map((h) => h.state),
    ["draft", "draft"],
  );

  const [h1, h2] = heats;
  // heat 1: two confirmed + the no-show. heat 2: one confirmed. #5 left unseeded.
  await setHeatForRegistrations(SLUG, h1.id, [id(1), id(2), id(4)]);
  await setHeatForRegistrations(SLUG, h2.id, [id(3)]);

  /* ── 2. publishEventHeats stamping ────────────────────────────────── */
  console.log("\n2. publishEventHeats");
  eq_("first press stamps 2 heats", await publishEventHeats(SLUG), 2);
  heats = await getEventHeats(SLUG);
  eq_(
    "both heats published",
    heats.map((h) => h.state),
    ["published", "published"],
  );
  const firstPublishedAt = heats[0].publishedAt!.getTime();
  eq_("second press stamps 0", await publishEventHeats(SLUG), 0);
  heats = await getEventHeats(SLUG);
  eq_("publishedAt not rewritten by a re-publish", heats[0].publishedAt!.getTime(), firstPublishedAt);
  eq_("finishedAt untouched", heats.map((h) => h.finishedAt), [null, null]);

  /* ── 3. first publish: everyone seeded and still coming is due ────── */
  console.log("\n3. first publish");
  let pool = await getSeedPool(SLUG);
  eq_("seed pool is 5 (4 confirmed + the seeded no-show)", pool.length, 5);
  eq_(
    "nobody has been notified yet",
    pool.filter((p) => p.heatId).map((p) => p.notifyState),
    ["none", "none", "none", "none"],
  );
  eq_("unseeded runner reads none", pool.find((p) => !p.heatId)?.notifyState, "none");
  eq_(
    "3 due — the no-show is not mailed",
    due(pool).map((p) => p.name).sort(),
    ["Anna Aaa", "Borys Bbb", "Cela Ccc"],
  );

  let s = await publishHeatsAndNotify(SLUG);
  eq_("published 0 — the card was already live", s.published, 0);
  eq_("seeded excludes the no-show", s.seeded, 3);
  eq_("no transport: 0 notified, 0 failed", [s.notified, s.failed], [0, 0]);
  eq_("no transport: nothing claimed as sent", s.skipped, 3);
  for (const n of [1, 2, 3]) {
    const c = await notifiedCols(id(n));
    check(
      `${PREFIX}${n}: notified* left null when nothing was sent`,
      c?.notifiedHeatId === null && c?.notifiedHeatTime === null,
    );
  }
  eq_(
    "no email_log rows written",
    (
      await db
        .select({ id: eventEmailLog.id })
        .from(eventEmailLog)
        .where(
          and(
            eq(eventEmailLog.kind, "heat_assignment"),
            inArray(eventEmailLog.eventRegistrationId, [...R.values()]),
          ),
        )
    ).length,
    0,
  );

  /* ── 4. after a delivered round, unchanged runners are skipped ────── */
  console.log("\n4. re-publish with nothing changed");
  await markNotified([id(1), id(2), id(3)]);
  pool = await getSeedPool(SLUG);
  eq_(
    "all three read notified",
    pool.filter((p) => p.heatId && p.status !== "no_show").map((p) => p.notifyState).sort(),
    ["notified", "notified", "notified"],
  );
  eq_("nobody due", due(pool).length, 0);
  s = await publishHeatsAndNotify(SLUG);
  eq_("all 3 skipped as unchanged", [s.seeded, s.skipped], [3, 3]);

  /* ── 5. a moved start time re-notifies only that heat ─────────────── */
  console.log("\n5. heat 2's start time moves");
  eq_(
    "heat 2 patched",
    await updateHeatRow(SLUG, h2.id, {
      scheduledAt: new Date(firstStart.getTime() + 25 * 60_000),
    }),
    "updated",
  );
  pool = await getSeedPool(SLUG);
  eq_("the moved runner reads stale", pool.find((p) => p.id === id(3))?.notifyState, "stale");
  eq_("heat 1 runners still read notified", pool.find((p) => p.id === id(1))?.notifyState, "notified");
  eq_(
    "exactly one due, and it is the moved runner",
    due(pool).map((p) => p.name),
    ["Cela Ccc"],
  );

  /* ── 6. a runner moved between heats ──────────────────────────────── */
  console.log("\n6. a runner moves to another heat");
  await markNotified([id(3)]);
  await setHeatForRegistrations(SLUG, h2.id, [id(1)]);
  pool = await getSeedPool(SLUG);
  eq_("the mover reads stale", pool.find((p) => p.id === id(1))?.notifyState, "stale");
  eq_(
    "exactly one due, and it is the mover",
    due(pool).map((p) => p.name),
    ["Anna Aaa"],
  );

  /* ── 7. a walk-up seeded after publication ────────────────────────── */
  console.log("\n7. late walk-up seeded into a published heat");
  await markNotified([id(1)]);
  eq_("quiet again", due(await getSeedPool(SLUG)).length, 0);
  await setHeatForRegistrations(SLUG, h1.id, [id(5)]);
  pool = await getSeedPool(SLUG);
  eq_("the walk-up reads none", pool.find((p) => p.id === id(5))?.notifyState, "none");
  eq_(
    "exactly one due, and it is the walk-up",
    due(pool).map((p) => p.name),
    ["Ewa Eee"],
  );
  s = await publishHeatsAndNotify(SLUG);
  eq_("seeded now 4", s.seeded, 4);

  /* ── 8. the seeded no-show ────────────────────────────────────────── */
  console.log("\n8. the seeded no-show");
  check("never notified", (await notifiedCols(id(4)))?.notifiedHeatId === null);
  check(
    "still on the card, so an admin can take them off",
    Boolean(pool.find((p) => p.id === id(4))?.heatId),
  );

  /* ── 9. heatNotifyState truth table ───────────────────────────────── */
  console.log("\n9. heatNotifyState truth table");
  const t0 = new Date("2026-08-22T08:00:00.000Z");
  const t1 = new Date("2026-08-22T08:10:00.000Z");
  eq_("unseeded → none", heatNotifyState({ heatId: null, scheduledAt: null, notifiedHeatId: null, notifiedHeatTime: null }), "none");
  eq_("never notified → none", heatNotifyState({ heatId: "a", scheduledAt: t0, notifiedHeatId: null, notifiedHeatTime: null }), "none");
  eq_("same heat, same instant → notified", heatNotifyState({ heatId: "a", scheduledAt: t0, notifiedHeatId: "a", notifiedHeatTime: new Date(t0) }), "notified");
  eq_("same heat, moved time → stale", heatNotifyState({ heatId: "a", scheduledAt: t1, notifiedHeatId: "a", notifiedHeatTime: t0 }), "stale");
  eq_("different heat → stale", heatNotifyState({ heatId: "b", scheduledAt: t0, notifiedHeatId: "a", notifiedHeatTime: t0 }), "stale");
  eq_("notified heat, null time → stale", heatNotifyState({ heatId: "a", scheduledAt: t0, notifiedHeatId: "a", notifiedHeatTime: null }), "stale");

  /* ── 10. isolation ───────────────────────────────────────────────── */
  console.log("\n10. live rows untouched");
  const live = await db
    .select({ id: eventRegistrations.id })
    .from(eventRegistrations)
    .where(eq(eventRegistrations.eventSlug, "mile-2026-08-01"));
  console.log(`  mile-2026-08-01 still reports ${live.length} registrations`);
  eq_("no heats leaked onto mile-2026-08-01", (await getEventHeats("mile-2026-08-01")).length, 0);
  eq_(
    "the #29 fixture on mile-2026-08-29 is untouched",
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
