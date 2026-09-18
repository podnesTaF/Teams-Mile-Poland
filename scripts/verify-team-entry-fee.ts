/**
 * DB round-trip for the **team entry fee** (ADR 0013, slice 4 of
 * planning/event-entry-fees).
 *
 *   ALLOW_FIXTURES=1 npx tsx --env-file=.env.local scripts/verify-team-entry-fee.ts
 *   ALLOW_FIXTURES=1 npx tsx --env-file=.env.local scripts/verify-team-entry-fee.ts --teardown
 *
 * Writes to whatever `DATABASE_URL` points at, so it refuses to run without
 * `ALLOW_FIXTURES=1` (`scripts/lib/guard.ts`). Needs migration 0028 applied.
 *
 * What it proves against the real data layer rather than by reading the code:
 *
 *  1. a priced night debits **exactly** the fee from the **treasury** — not
 *     from the manager's wallet, not from anyone's — and the entry, the member
 *     registrations and the seats all exist;
 *  2. a treasury that is short is refused and **nothing at all** is written:
 *     no entry, no registrations, no seats, no ledger row (the rollback is
 *     measured, not assumed);
 *  3. a night priced `0` writes no ledger row and behaves exactly as before;
 *  4. two concurrent entries on a treasury that covers one: exactly one wins;
 *  5. `addEntryMember`'s row layer charges nothing — the fee is per team per
 *     night, not per head;
 *  6. the fee row is keyed `team_entry_fee:<entryId>` and replaying that key
 *     writes nothing, which is the handle slice 5's refund looks it up by.
 *
 * **It drives the row layer, not the server actions.** `enterTeam` runs
 * `requireTeamManagerOrAdmin` (a real session behind `next/headers`) and then
 * mails every member, and `.env.local` holds a live Resend key — so nothing
 * here imports `mail-entries`, directly or transitively, and no fixture address
 * is ever sent to. What the actions add over this is a pre-check that reads the
 * same balance this proves, and the mapping of the sentinel to a refusal key;
 * what only the transaction can prove is everything above.
 *
 * Every fixture is prefixed `tef-` and every delete is scoped to ids this
 * script created, in a `finally`.
 */
import { and, eq, inArray, like, sql } from "drizzle-orm";

import { eventRegistrations } from "../src/db/schema/event-registrations";
import { events } from "../src/db/schema/events";
import { teamEntries, teamEntryMembers } from "../src/db/schema/team-entries";
import { users, userTeamMembers, userTeams, walletTransactions } from "../src/db/schema";
import { isUniqueViolation } from "../src/features/teams/creation";
import { entryShortfall } from "../src/features/teams/eligibility";
import {
  addMemberRows,
  createEntryRows,
  getEntryMembers,
  getTeamEntryCandidates,
  teamEntryFeeKey,
} from "../src/features/teams/entries";
import { acerToMinor } from "../src/features/wallet/config";
import {
  getAcerBalance,
  getTeamAcerBalance,
  recordWalletTransaction,
} from "../src/features/wallet/data";
import { teamEntryFeeMinor } from "../src/features/wallet/entry-fees";
import { isInsufficientAcer } from "../src/features/wallet/errors";
import { getDb } from "../src/lib/db";
import { getEventBySlug } from "../src/lib/events/store";
import { requireFixtureConsent } from "./lib/guard";

requireFixtureConsent("scripts/verify-team-entry-fee.ts");

const PREFIX = "tef-";
const FEE_ACER = 100;
const FEE_MINOR = acerToMinor(FEE_ACER);

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

async function expectThrow(
  label: string,
  run: () => Promise<unknown>,
  matches: (e: unknown) => boolean,
) {
  try {
    await run();
    check(label, false, "did not throw");
  } catch (error) {
    check(label, matches(error), String(error));
  }
}

/* ------------------------------------------------------------- fixtures */

/** Seven runners is a men's composition: 3 RACERS + 2 pairs × 2. */
const ROSTER_SIZE = 7;

async function makeUser(suffix: string): Promise<string> {
  const id = `${PREFIX}${suffix}`;
  await getDb()
    .insert(users)
    .values({
      id,
      name: `Fee ${suffix}`,
      firstName: `F${suffix}`,
      lastName: "Fixture",
      // `.test` is reserved (RFC 2606) and can never be delivered to.
      email: `${id}@example.test`,
      emailVerified: true,
      locale: "en",
      sex: "M",
      // Comfortably over 18 on any event date this script invents.
      dateOfBirth: new Date("1990-01-01"),
    });
  return id;
}

async function makeTeam(suffix: string, managerUserId: string) {
  const [team] = await getDb()
    .insert(userTeams)
    .values({
      slug: `${PREFIX}${suffix}`,
      code: `F${suffix.toUpperCase().slice(0, 5)}`,
      name: `${PREFIX}${suffix}`,
      region: "Warsaw",
      category: "men",
      recruiting: false,
      managerUserId,
    })
    .returning();
  await getDb()
    .insert(userTeamMembers)
    .values({ teamId: team.id, userId: managerUserId, role: "manager", category: "men" });
  return team;
}

async function addToRoster(teamId: string, userId: string) {
  await getDb().insert(userTeamMembers).values({ teamId, userId, role: "member", category: "men" });
}

/**
 * A team with a full men's composition on its roster: a manager plus six
 * runners, all its own.
 *
 * Every squad gets **fresh** accounts rather than sharing one pool, because
 * `user_team_members_user_category_uq` allows a person one team per category —
 * the same rule that stops a runner racing for two men's teams in a season, and
 * it applies to fixtures exactly as it does to people.
 */
async function makeSquad(suffix: string) {
  const manager = await makeUser(`${suffix}-mgr`);
  const team = await makeTeam(suffix, manager);
  for (let i = 1; i < ROSTER_SIZE; i++) {
    await addToRoster(team.id, await makeUser(`${suffix}-r${i}`));
  }
  const roster = await getTeamEntryCandidates(team.id);
  return {
    team,
    manager,
    roster,
    seats: roster.map((m) => ({ userId: m.userId, locale: m.locale })),
  };
}

/**
 * A fixture night with a price on it. **Never the real October rows** — pricing
 * those is slice 6's decision and its own script; this invents its own event
 * and deletes it again.
 */
async function makeEvent(suffix: string, teamEntryFeeAcer: number): Promise<string> {
  const slug = `${PREFIX}${suffix}`;
  await getDb()
    .insert(events)
    .values({
      slug,
      status: "registration_open",
      eventType: "team",
      name: `Fee fixture ${suffix}`,
      date: "2099-12-31",
      startTime: "17:30",
      endTime: "20:30",
      venue: "Fixture",
      city: "Warsaw",
      teamEntryFeeAcer,
    });
  return slug;
}

/** Fund a treasury the way an admin grant does — one row, no transfer legs. */
async function fund(teamId: string, acer: number, createdBy: string) {
  await recordWalletTransaction({
    teamId,
    asset: "ACER",
    amountMinor: acerToMinor(acer),
    kind: "admin_credit",
    memo: "fixture",
    createdBy,
  });
}

async function teamRows(teamId: string) {
  return getDb()
    .select()
    .from(walletTransactions)
    .where(eq(walletTransactions.teamId, teamId))
    .orderBy(walletTransactions.createdAt, walletTransactions.id);
}

async function countEntries(teamId: string, eventSlug: string): Promise<number> {
  const [row] = await getDb()
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(teamEntries)
    .where(and(eq(teamEntries.teamId, teamId), eq(teamEntries.eventSlug, eventSlug)));
  return row?.n ?? 0;
}

async function countRegistrations(eventSlug: string): Promise<number> {
  const [row] = await getDb()
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(eventRegistrations)
    .where(eq(eventRegistrations.eventSlug, eventSlug));
  return row?.n ?? 0;
}

async function countSeats(entryIds: string[]): Promise<number> {
  if (entryIds.length === 0) return 0;
  const [row] = await getDb()
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(teamEntryMembers)
    .where(inArray(teamEntryMembers.entryId, entryIds));
  return row?.n ?? 0;
}

/* ------------------------------------------------------------- teardown */

/**
 * Delete exactly what this script created, in FK order, scoped by the `tef-`
 * prefix on the ids and slugs it minted. Never a broad delete: the ledger is
 * append-only and shared, so only rows owned by a fixture team or written by a
 * fixture user go.
 */
async function teardown(quiet = false) {
  const db = getDb();

  const userIds = (
    await db
      .select({ id: users.id })
      .from(users)
      .where(like(users.id, `${PREFIX}%`))
  ).map((r) => r.id);
  const teamIds = (
    await db
      .select({ id: userTeams.id })
      .from(userTeams)
      .where(like(userTeams.slug, `${PREFIX}%`))
  ).map((r) => r.id);
  const eventSlugs = (
    await db
      .select({ slug: events.slug })
      .from(events)
      .where(like(events.slug, `${PREFIX}%`))
  ).map((r) => r.slug);

  // Entries first: seats cascade with them, and the registrations they point at
  // must outlive the seats' FK.
  if (teamIds.length) await db.delete(teamEntries).where(inArray(teamEntries.teamId, teamIds));
  if (eventSlugs.length) {
    await db.delete(eventRegistrations).where(inArray(eventRegistrations.eventSlug, eventSlugs));
  }
  if (teamIds.length || userIds.length) {
    await db
      .delete(walletTransactions)
      .where(
        teamIds.length && userIds.length
          ? sql`${inArray(walletTransactions.teamId, teamIds)} or ${inArray(walletTransactions.userId, userIds)} or ${inArray(walletTransactions.createdBy, userIds)}`
          : teamIds.length
            ? inArray(walletTransactions.teamId, teamIds)
            : inArray(walletTransactions.userId, userIds),
      );
  }
  if (teamIds.length) await db.delete(userTeams).where(inArray(userTeams.id, teamIds));
  if (userIds.length) await db.delete(users).where(inArray(users.id, userIds));
  if (eventSlugs.length) await db.delete(events).where(inArray(events.slug, eventSlugs));

  if (!quiet) {
    console.log(
      `\ntore down ${userIds.length} users, ${teamIds.length} teams, ${eventSlugs.length} events`,
    );
  }
}

/* ------------------------------------------------------------------ run */

async function run() {
  await teardown(true);

  const { team: rich, manager, roster, seats } = await makeSquad("rich");
  const runners = roster.filter((m) => m.userId !== manager).map((m) => m.userId);
  await fund(rich.id, FEE_ACER, manager);

  const pricedSlug = await makeEvent("priced", FEE_ACER);
  const freeSlug = await makeEvent("free", 0);

  /* ── 0. the price is read off the event through the helper ────── */
  console.log("\n0. the price comes from the event row, through teamEntryFeeMinor");
  const pricedEvent = await getEventBySlug(pricedSlug);
  const freeEvent = await getEventBySlug(freeSlug);
  eq_("priced night is 100 ACER = 10000 minor", teamEntryFeeMinor(pricedEvent), FEE_MINOR);
  eq_("free night is 0", teamEntryFeeMinor(freeEvent), 0);

  eq_("roster is seven", roster.length, ROSTER_SIZE);
  eq_("composition is satisfied (shortfall 0)", entryShortfall("men", roster), 0);

  /* ── 1. a priced entry debits the treasury, exactly once ──────── */
  console.log("\n1. a priced entry debits the treasury and writes the whole entry");
  const treasuryBefore = await getTeamAcerBalance(rich.id);
  const managerWalletBefore = await getAcerBalance(manager);
  console.log(
    `   treasury before: ${treasuryBefore} minor; manager wallet: ${managerWalletBefore}`,
  );

  const entered = await createEntryRows({
    team: rich,
    eventSlug: pricedSlug,
    actorUserId: manager,
    seats,
    feeMinor: FEE_MINOR,
  });
  check("entry created", entered.ok, JSON.stringify(entered));
  if (!entered.ok) throw new Error("cannot continue without an entry");
  const entryId = entered.entryId;

  const treasuryAfter = await getTeamAcerBalance(rich.id);
  console.log(`   treasury after:  ${treasuryAfter} minor (fee ${FEE_MINOR})`);
  eq_("treasury fell by exactly the fee", treasuryBefore - treasuryAfter, FEE_MINOR);
  eq_("treasury is now empty", treasuryAfter, 0);
  eq_("the manager's own wallet is untouched", await getAcerBalance(manager), managerWalletBefore);
  for (const id of runners) {
    eq_(`runner ${id} paid nothing`, await getAcerBalance(id), 0);
  }

  const feeRows = (await teamRows(rich.id)).filter((r) => r.kind === "team_entry_fee");
  eq_("exactly one fee row", feeRows.length, 1);
  eq_("fee row is negative and exact", feeRows[0]?.amountMinor, -FEE_MINOR);
  eq_("fee row is owned by the team", feeRows[0]?.teamId, rich.id);
  eq_("fee row has no user owner", feeRows[0]?.userId, null);
  eq_("fee row records who pressed Enter", feeRows[0]?.createdBy, manager);
  eq_("fee row points at the night", feeRows[0]?.reference, `event:${pricedSlug}`);
  eq_("fee row is keyed by the entry", feeRows[0]?.idempotencyKey, teamEntryFeeKey(entryId));
  eq_("fee row is completed", feeRows[0]?.status, "completed");

  eq_("one entry exists", await countEntries(rich.id, pricedSlug), 1);
  eq_("seven registrations exist", await countRegistrations(pricedSlug), ROSTER_SIZE);
  eq_("seven seats exist", await countSeats([entryId]), ROSTER_SIZE);
  eq_("the entry reads back seven members", (await getEntryMembers(entryId)).length, ROSTER_SIZE);

  /* ── 2. the key is the handle, and replaying it writes nothing ── */
  console.log("\n2. the fee row's key is idempotent (slice 5 looks it up by this)");
  const rowsBefore2 = (await teamRows(rich.id)).length;
  const replay = await recordWalletTransaction({
    teamId: rich.id,
    asset: "ACER",
    amountMinor: -FEE_MINOR,
    kind: "team_entry_fee",
    reference: `event:${pricedSlug}`,
    idempotencyKey: teamEntryFeeKey(entryId),
  });
  eq_("a replay of the key is a no-op (null)", replay, null);
  eq_("no second fee row", (await teamRows(rich.id)).length, rowsBefore2);
  eq_("treasury unchanged", await getTeamAcerBalance(rich.id), 0);

  console.log("   and a double-submitted Enter cannot write a second entry either");
  await fund(rich.id, FEE_ACER, manager); // so the refusal cannot be about money
  await expectThrow(
    "second entry for the same team+night is refused by team_entries_team_event_uq",
    () =>
      createEntryRows({
        team: rich,
        eventSlug: pricedSlug,
        actorUserId: manager,
        seats,
        feeMinor: FEE_MINOR,
      }),
    // Through `isUniqueViolation`, which walks `cause`: Drizzle wraps the
    // failed query and the constraint name is not on the top-level error.
    (e) => isUniqueViolation(e, "team_entries_team_event_uq"),
  );
  eq_("still exactly one entry", await countEntries(rich.id, pricedSlug), 1);
  eq_(
    "still exactly one fee row",
    (await teamRows(rich.id)).filter((r) => r.kind === "team_entry_fee").length,
    1,
  );
  eq_(
    "the re-funded 100 is still there — nothing was charged",
    await getTeamAcerBalance(rich.id),
    FEE_MINOR,
  );

  /* ── 3. a short treasury is refused and writes nothing ────────── */
  console.log("\n3. a short treasury is refused and the transaction writes nothing");
  const { team: poor, manager: poorManager, seats: poorSeats } = await makeSquad("poor");
  await fund(poor.id, 40, poorManager);
  const shortSlug = await makeEvent("short", FEE_ACER);

  const poorBefore = await getTeamAcerBalance(poor.id);
  const poorRowsBefore = (await teamRows(poor.id)).length;
  console.log(`   treasury: ${poorBefore} minor, fee: ${FEE_MINOR} minor`);
  await expectThrow(
    "refused with InsufficientAcerError",
    () =>
      createEntryRows({
        team: poor,
        eventSlug: shortSlug,
        actorUserId: poorManager,
        seats: poorSeats,
        feeMinor: FEE_MINOR,
      }),
    isInsufficientAcer,
  );
  eq_("no entry was written", await countEntries(poor.id, shortSlug), 0);
  eq_("no registrations were written", await countRegistrations(shortSlug), 0);
  eq_("no ledger row was written", (await teamRows(poor.id)).length, poorRowsBefore);
  eq_("the treasury still holds what it held", await getTeamAcerBalance(poor.id), poorBefore);

  /* ── 4. a free night behaves exactly as before ────────────────── */
  console.log("\n4. a night priced 0 writes no ledger row");
  const freeRowsBefore = (await teamRows(poor.id)).length;
  const freeEntered = await createEntryRows({
    team: poor,
    eventSlug: freeSlug,
    actorUserId: poorManager,
    seats: poorSeats,
    feeMinor: 0,
  });
  check("free entry created", freeEntered.ok, JSON.stringify(freeEntered));
  if (!freeEntered.ok) throw new Error("free entry failed");
  eq_("no new ledger row at all", (await teamRows(poor.id)).length, freeRowsBefore);
  eq_(
    "no zero-amount row was written",
    (await teamRows(poor.id)).filter((r) => r.amountMinor === 0).length,
    0,
  );
  eq_("the treasury is untouched", await getTeamAcerBalance(poor.id), poorBefore);
  eq_("the entry exists", await countEntries(poor.id, freeSlug), 1);
  eq_("its registrations exist", await countRegistrations(freeSlug), ROSTER_SIZE);
  eq_("its seats exist", await countSeats([freeEntered.entryId]), ROSTER_SIZE);

  /* ── 5. two concurrent entries, one treasury that covers one ──── */
  console.log("\n5. two concurrent entries on a treasury that covers exactly one");
  // Two *different* nights on purpose: the same night twice would be settled by
  // `team_entries_team_event_uq` and would prove the unique index, not the
  // treasury lock. Both priced 100, treasury holds 100.
  const { team: raceTeam, manager: raceManager, seats: raceSeats } = await makeSquad("race");
  await fund(raceTeam.id, FEE_ACER, raceManager);
  const nightA = await makeEvent("race-a", FEE_ACER);
  const nightB = await makeEvent("race-b", FEE_ACER);

  const results = await Promise.allSettled([
    createEntryRows({
      team: raceTeam,
      eventSlug: nightA,
      actorUserId: raceManager,
      seats: raceSeats,
      feeMinor: FEE_MINOR,
    }),
    createEntryRows({
      team: raceTeam,
      eventSlug: nightB,
      actorUserId: raceManager,
      seats: raceSeats,
      feeMinor: FEE_MINOR,
    }),
  ]);
  const fulfilled = results.filter((r) => r.status === "fulfilled").length;
  const refused = results.filter(
    (r) => r.status === "rejected" && isInsufficientAcer(r.reason),
  ).length;
  console.log(`   ${fulfilled} succeeded, ${refused} refused for want of ACER`);
  eq_("exactly one succeeded", fulfilled, 1);
  eq_("the other was refused for want of ACER", refused, 1);
  eq_("the treasury is empty, not overdrawn", await getTeamAcerBalance(raceTeam.id), 0);
  eq_(
    "exactly one fee row on the team",
    (await teamRows(raceTeam.id)).filter((r) => r.kind === "team_entry_fee").length,
    1,
  );
  const raceEntries = await getDb()
    .select({ id: teamEntries.id })
    .from(teamEntries)
    .where(eq(teamEntries.teamId, raceTeam.id));
  eq_("exactly one entry row", raceEntries.length, 1);

  /* ── 6. adding a member after a paid entry is free ────────────── */
  console.log("\n6. adding a member to a paid entry charges nothing");
  const latecomer = await makeUser("latecomer");
  await addToRoster(rich.id, latecomer);
  const beforeAdd = await getTeamAcerBalance(rich.id);
  const rowsBeforeAdd = (await teamRows(rich.id)).length;
  const added = await addMemberRows({
    entryId,
    eventSlug: pricedSlug,
    seat: { userId: latecomer, locale: "en" },
  });
  check("member added", added.ok, JSON.stringify(added));
  eq_("treasury unchanged by the add", await getTeamAcerBalance(rich.id), beforeAdd);
  eq_("no ledger row written by the add", (await teamRows(rich.id)).length, rowsBeforeAdd);
  eq_("the latecomer paid nothing either", await getAcerBalance(latecomer), 0);
  eq_("the entry now has eight seats", await countSeats([entryId]), ROSTER_SIZE + 1);

  console.log(`\n${pass} passed, ${fail} failed`);
}

async function main() {
  if (process.argv.includes("--teardown")) {
    await teardown();
    return 0;
  }
  try {
    await run();
    return fail > 0 ? 1 : 0;
  } catch (error) {
    console.error(error);
    return 1;
  } finally {
    // Always, however it ended: the live database keeps nothing of this.
    await teardown().catch((error) => console.error("teardown failed:", error));
  }
}

// The pool keeps the event loop alive; exit explicitly rather than hang.
main().then((code) => process.exit(code));
