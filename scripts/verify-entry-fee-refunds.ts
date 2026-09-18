/**
 * DB round-trip for **entry fee refunds** (ADR 0013 decision 6, slice 5 of
 * `planning/event-entry-fees`).
 *
 *   ALLOW_FIXTURES=1 npx tsx --env-file=.env.local scripts/verify-entry-fee-refunds.ts
 *   ALLOW_FIXTURES=1 npx tsx --env-file=.env.local scripts/verify-entry-fee-refunds.ts --teardown
 *
 * Writes to whatever `DATABASE_URL` points at, so it refuses to run without
 * `ALLOW_FIXTURES=1` (`scripts/lib/guard.ts`). There is no branch DB.
 *
 * What it proves against the real data layer rather than by reading the code:
 *
 *  1. the two fee-key spellings this feature has to *find* rows by agree with
 *     the rows slices 3 and 4 actually write — the one failure that would make
 *     every refund below silently do nothing;
 *  2. withdrawing while the night is `registration_open` puts the treasury back
 *     to exactly what it held before entering, with exactly one
 *     `entry_fee_refund` row whose `reverses_id` points at the fee row;
 *  3. withdrawing after registration closed refunds nothing and leaves the
 *     treasury exactly as it was;
 *  4. withdrawing twice, and refunding the same fee twice, each credit once;
 *  5. a free night withdrawn writes no refund row and does not error;
 *  6. cancelling a night refunds every fee it took — team entries **and**
 *     individual registrations — and a second sweep writes nothing;
 *  7. a cancelled night with one paid and one comped participant refunds
 *     exactly one of them;
 *  8. a fee forfeited by a late withdrawal still comes back when the night is
 *     then cancelled (see the note below — a deliberate consequence of driving
 *     the sweep off the ledger);
 *  9. every balance reconciles as a `SUM` over the owner's `completed` rows.
 *
 * **It drives the row layer and the primitives, never the server actions.**
 * `withdrawEntry` mails every member of the entry and `.env.local` holds a live
 * Resend key, so nothing here imports `mail-entries`, directly or transitively,
 * and no fixture address is ever sent to. What only the action adds is the
 * session gate and the `refundsOnWithdrawal` decision — and that predicate is
 * imported and used here to derive the flag, so the decision under test is the
 * real one. The cancellation sweep is likewise driven as `refundEventFees`:
 * `setEventStatus` is a form action that ends in a `redirect`, and forging an
 * admin session would verify a login rather than the refund arithmetic.
 *
 * The fixture nights are created `registration_open` / `registration_closed`
 * because the behaviour under test *is* the lifecycle status; they are dated
 * 2099-12-31 and deleted in the same run, the way `verify-team-entry-fee.ts`
 * does it.
 *
 * Every fixture is prefixed `efr-` and every delete is scoped to ids this script
 * created, in a `finally`.
 */
import { and, eq, inArray, like, sql } from "drizzle-orm";

import {
  consentSubmissions,
  eventRegistrations,
  events,
  registrationConsents,
  teamEntries,
  users,
  userTeamMembers,
  userTeams,
  walletTransactions,
} from "../src/db/schema";
import {
  createFreeRegistration,
  createRegistrationWithConsent,
} from "../src/features/event-registration/data";
import {
  createEntryRows,
  getEntryMembers,
  getTeamEntryCandidates,
  refundsOnWithdrawal,
  teamEntryFeeKey,
  withdrawEntryRows,
} from "../src/features/teams/entries";
import { acerToMinor } from "../src/features/wallet/config";
import {
  getAcerBalance,
  getTeamAcerBalance,
  getWalletTransactionByKey,
  recordWalletTransaction,
} from "../src/features/wallet/data";
import {
  entryFeeCauseId,
  entryFeeRefundKey,
  individualEntryFeeKey,
  refundEntryFee,
  refundEventFees,
} from "../src/features/wallet/refunds";
import { getDb } from "../src/lib/db";
import { buildConsentRows, termsAcceptedFrom } from "../src/lib/legal/consent";
import type { ConsentItemsInput } from "../src/lib/legal/consent";
import { requireFixtureConsent } from "./lib/guard";

requireFixtureConsent("scripts/verify-entry-fee-refunds.ts");

const PREFIX = "efr-";
const TEAM_FEE_ACER = 100;
const TEAM_FEE_MINOR = acerToMinor(TEAM_FEE_ACER);
const SOLO_FEE_ACER = 5;
const SOLO_FEE_MINOR = acerToMinor(SOLO_FEE_ACER);

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

/* ------------------------------------------------------------- fixtures */

/** Seven runners is a men's composition: 3 RACERS + 2 pairs × 2. */
const ROSTER_SIZE = 7;

async function makeUser(suffix: string): Promise<string> {
  const id = `${PREFIX}${suffix}`;
  await getDb()
    .insert(users)
    .values({
      id,
      name: `Refund ${suffix}`,
      firstName: `R${suffix}`,
      lastName: "Fixture",
      // `.test` is reserved (RFC 2606) and can never be delivered to.
      email: `${id}@example.test`,
      emailVerified: true,
      locale: "en",
      sex: "M",
      dateOfBirth: new Date("1990-01-01"),
    });
  return id;
}

/**
 * A team with a full men's composition on its roster. Fresh accounts per squad:
 * `user_team_members_user_category_uq` gives a person one team per category, and
 * it applies to fixtures exactly as it does to people.
 */
async function makeSquad(suffix: string) {
  const manager = await makeUser(`${suffix}-mgr`);
  const [team] = await getDb()
    .insert(userTeams)
    .values({
      slug: `${PREFIX}${suffix}`,
      code: `R${suffix.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5)}`,
      name: `${PREFIX}${suffix}`,
      region: "Warsaw",
      category: "men",
      recruiting: false,
      managerUserId: manager,
    })
    .returning();
  await getDb()
    .insert(userTeamMembers)
    .values({ teamId: team.id, userId: manager, role: "manager", category: "men" });
  for (let i = 1; i < ROSTER_SIZE; i++) {
    const member = await makeUser(`${suffix}-r${i}`);
    await getDb()
      .insert(userTeamMembers)
      .values({ teamId: team.id, userId: member, role: "member", category: "men" });
  }
  const roster = await getTeamEntryCandidates(team.id);
  return {
    team,
    manager,
    seats: roster.map((m) => ({ userId: m.userId, locale: m.locale })),
  };
}

/**
 * A fixture night. **Never one of the real October rows** — those are slice 6's
 * to price, and this script invents its own and deletes them again.
 */
async function makeEvent(
  suffix: string,
  {
    status = "registration_open",
    team = 0,
    solo = 0,
  }: { status?: "registration_open" | "registration_closed"; team?: number; solo?: number } = {},
): Promise<string> {
  const slug = `${PREFIX}${suffix}`;
  await getDb()
    .insert(events)
    .values({
      slug,
      status,
      eventType: "mixed",
      name: `Refund fixture ${suffix}`,
      date: "2099-12-31",
      startTime: "17:30",
      endTime: "20:30",
      venue: "Fixture",
      city: "Warsaw",
      teamEntryFeeAcer: team,
      individualEntryFeeAcer: solo,
    });
  return slug;
}

/** Fund an account the way an admin grant does — one row, no transfer legs. */
async function fund(owner: { teamId: string } | { userId: string }, acer: number) {
  await recordWalletTransaction({
    ...owner,
    asset: "ACER",
    amountMinor: acerToMinor(acer),
    kind: "admin_credit",
    memo: "fixture",
  });
}

/** The six individual consents, all answered — what a valid submission carries. */
const ITEMS: ConsentItemsInput = {
  rulesAndRegulations: true,
  ageHealthRisks: true,
  dataTruthfulAndRodo: true,
  publicResultsAwareness: true,
  prizeDataUnderstanding: true,
  imageUse: "agree",
};

/** A real individual registration, fee and consent evidence and all (slice 3). */
async function registerSolo(eventSlug: string, userId: string, feeMinor: number) {
  return createRegistrationWithConsent({
    registration: {
      eventSlug,
      userId,
      locale: "en",
      terms: termsAcceptedFrom("individual", ITEMS),
    },
    submission: {
      docSet: "individual",
      locale: "en",
      snapshot: {
        fullName: `Fixture ${userId}`,
        birthDate: "1990-01-01",
        phoneEmail: `${userId}@example.test`,
        address: "Fixture 1, Warsaw",
        emergencyContact: "Fixture Contact +48 000 000 000",
      },
      ip: null,
      userAgent: "verify-entry-fee-refunds",
    },
    consents: buildConsentRows("individual", ITEMS),
    feeMinor,
  });
}

/** Every ledger row of one owner, oldest first. */
async function rowsOf(owner: { teamId: string } | { userId: string }) {
  const where =
    "teamId" in owner
      ? eq(walletTransactions.teamId, owner.teamId)
      : eq(walletTransactions.userId, owner.userId);
  return getDb()
    .select()
    .from(walletTransactions)
    .where(where)
    .orderBy(walletTransactions.createdAt, walletTransactions.id);
}

/** The balance the hard way — a raw `SUM` over the owner's `completed` rows. */
async function rawBalance(owner: { teamId: string } | { userId: string }): Promise<number> {
  const where =
    "teamId" in owner
      ? eq(walletTransactions.teamId, owner.teamId)
      : eq(walletTransactions.userId, owner.userId);
  const [row] = await getDb()
    .select({ total: sql<number>`coalesce(sum(${walletTransactions.amountMinor}), 0)`.mapWith(Number) })
    .from(walletTransactions)
    .where(and(where, eq(walletTransactions.asset, "ACER"), eq(walletTransactions.status, "completed")));
  return row?.total ?? 0;
}

async function refundRows(owner: { teamId: string } | { userId: string }) {
  return (await rowsOf(owner)).filter((r) => r.kind === "entry_fee_refund");
}

/* ------------------------------------------------------------- teardown */

/**
 * Delete exactly what this script created, in FK order, scoped by the `efr-`
 * prefix. Never a broad delete: the ledger is append-only and shared, so only
 * rows owned by a fixture team or a fixture user go — and the refund rows go
 * first, because each one references a fee row through `reverses_id`.
 */
async function teardown(quiet = false) {
  const db = getDb();

  const userIds = (
    await db.select({ id: users.id }).from(users).where(like(users.id, `${PREFIX}%`))
  ).map((r) => r.id);
  const teamIds = (
    await db.select({ id: userTeams.id }).from(userTeams).where(like(userTeams.slug, `${PREFIX}%`))
  ).map((r) => r.id);
  const eventSlugs = (
    await db.select({ slug: events.slug }).from(events).where(like(events.slug, `${PREFIX}%`))
  ).map((r) => r.slug);

  if (eventSlugs.length) {
    const regIds = (
      await db
        .select({ id: eventRegistrations.id })
        .from(eventRegistrations)
        .where(inArray(eventRegistrations.eventSlug, eventSlugs))
    ).map((r) => r.id);
    if (regIds.length) {
      const subIds = (
        await db
          .select({ id: consentSubmissions.id })
          .from(consentSubmissions)
          .where(inArray(consentSubmissions.registrationId, regIds))
      ).map((r) => r.id);
      if (subIds.length) {
        await db
          .delete(registrationConsents)
          .where(inArray(registrationConsents.submissionId, subIds));
        await db.delete(consentSubmissions).where(inArray(consentSubmissions.id, subIds));
      }
    }
  }

  // Entries first: seats cascade with them, and the registrations they point at
  // must outlive the seats' FK.
  if (teamIds.length) await db.delete(teamEntries).where(inArray(teamEntries.teamId, teamIds));
  if (eventSlugs.length) {
    await db.delete(eventRegistrations).where(inArray(eventRegistrations.eventSlug, eventSlugs));
  }

  if (teamIds.length || userIds.length) {
    const ownedByFixture =
      teamIds.length && userIds.length
        ? sql`${inArray(walletTransactions.teamId, teamIds)} or ${inArray(walletTransactions.userId, userIds)} or ${inArray(walletTransactions.createdBy, userIds)}`
        : teamIds.length
          ? inArray(walletTransactions.teamId, teamIds)
          : inArray(walletTransactions.userId, userIds);
    // `reverses_id` is a self-FK with no cascade: the undoing rows go first.
    await db
      .delete(walletTransactions)
      .where(and(ownedByFixture, sql`${walletTransactions.reversesId} is not null`));
    await db.delete(walletTransactions).where(ownedByFixture);
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

  /* ── 0. the keys the refund finds fee rows by ─────────────────── */
  console.log("\n0. the fee-key spellings agree with what the two writers produce");
  eq_("a team fee key parses back to its entry id", entryFeeCauseId(teamEntryFeeKey("E1")), "E1");
  eq_(
    "an individual fee key parses back to its registration id",
    entryFeeCauseId(individualEntryFeeKey("R1")),
    "R1",
  );
  eq_("an unrelated key is not a fee key", entryFeeCauseId("participation:R1"), null);
  eq_("a missing key is not a fee key", entryFeeCauseId(null), null);
  eq_("the refund key is derived from the cause", entryFeeRefundKey("E1"), "entry_fee_refund:E1");

  console.log("\n   and the withdrawal predicate is the lifecycle rule, nothing else");
  eq_("open refunds", refundsOnWithdrawal({ status: "registration_open" }), true);
  eq_("closed does not", refundsOnWithdrawal({ status: "registration_closed" }), false);
  eq_("completed does not", refundsOnWithdrawal({ status: "completed" }), false);
  eq_("an unknown night does not", refundsOnWithdrawal(null), false);

  /* ── 1. withdraw while open: the treasury is made whole ───────── */
  console.log("\n1. withdrawing while registration is open refunds the fee in full");
  const openSlug = await makeEvent("open", { status: "registration_open", team: TEAM_FEE_ACER });
  const open = await makeSquad("open");
  await fund({ teamId: open.team.id }, TEAM_FEE_ACER);

  const beforeEntry = await getTeamAcerBalance(open.team.id);
  console.log(`   treasury before entering: ${beforeEntry} minor`);
  const entered = await createEntryRows({
    team: open.team,
    eventSlug: openSlug,
    actorUserId: open.manager,
    seats: open.seats,
    feeMinor: TEAM_FEE_MINOR,
  });
  if (!entered.ok) throw new Error(`entry failed: ${JSON.stringify(entered)}`);
  const afterEntry = await getTeamAcerBalance(open.team.id);
  console.log(`   treasury after entering:  ${afterEntry} minor (fee ${TEAM_FEE_MINOR})`);
  eq_("the entry took exactly the fee", beforeEntry - afterEntry, TEAM_FEE_MINOR);

  const feeRow = await getWalletTransactionByKey(
    { teamId: open.team.id },
    teamEntryFeeKey(entered.entryId),
  );
  check("the fee row is findable by its key", feeRow !== null);

  const openMembers = await getEntryMembers(entered.entryId);
  const withdrawn = await withdrawEntryRows(
    entered.entryId,
    openMembers.map((m) => m.registrationId),
    // The action's own decision, computed by the action's own predicate.
    { refundFee: refundsOnWithdrawal({ status: "registration_open" }), actorUserId: open.manager },
  );
  check("withdrawal succeeded", withdrawn.ok, JSON.stringify(withdrawn));
  if (!withdrawn.ok) throw new Error("cannot continue");
  const afterWithdraw = await getTeamAcerBalance(open.team.id);
  console.log(
    `   treasury after withdrawing: ${afterWithdraw} minor (refunded ${withdrawn.refundedMinor})`,
  );
  eq_("the row layer reports the refund", withdrawn.refundedMinor, TEAM_FEE_MINOR);
  eq_("the treasury is back to exactly what it held before entering", afterWithdraw, beforeEntry);

  const openRefunds = await refundRows({ teamId: open.team.id });
  eq_("exactly one refund row", openRefunds.length, 1);
  eq_("it is a credit for exactly the fee", openRefunds[0]?.amountMinor, TEAM_FEE_MINOR);
  eq_("it is the refund kind, not a reversal", openRefunds[0]?.kind, "entry_fee_refund");
  eq_("it reverses the fee row", openRefunds[0]?.reversesId, feeRow?.id);
  eq_("it names the night", openRefunds[0]?.reference, `event:${openSlug}`);
  eq_("it is keyed by the entry", openRefunds[0]?.idempotencyKey, entryFeeRefundKey(entered.entryId));
  eq_("it records who withdrew", openRefunds[0]?.createdBy, open.manager);
  eq_("it is completed", openRefunds[0]?.status, "completed");
  eq_("the entry is gone", (await getEntryMembers(entered.entryId)).length, 0);

  console.log("\n   and the balance reconciles as a raw SUM over completed rows");
  const openRaw = await rawBalance({ teamId: open.team.id });
  console.log(`   SUM(amount_minor) = ${openRaw}, pre-entry balance = ${beforeEntry}`);
  eq_("SUM equals the pre-entry balance exactly", openRaw, beforeEntry);

  /* ── 2. withdrawing twice refunds once ────────────────────────── */
  console.log("\n2. withdrawing twice refunds once");
  const second = await withdrawEntryRows(
    entered.entryId,
    openMembers.map((m) => m.registrationId),
    { refundFee: true, actorUserId: open.manager },
  );
  check("the second withdrawal is still a success", second.ok, JSON.stringify(second));
  eq_("it refunds nothing", second.ok ? second.refundedMinor : -1, 0);
  eq_("still exactly one refund row", (await refundRows({ teamId: open.team.id })).length, 1);
  eq_("the treasury did not double", await getTeamAcerBalance(open.team.id), beforeEntry);

  /* ── 3. refunding the same fee twice credits once ─────────────── */
  console.log("\n3. the refund key itself, driven twice against a live entry");
  const twiceSlug = await makeEvent("twice", { team: TEAM_FEE_ACER });
  const twice = await makeSquad("twice");
  await fund({ teamId: twice.team.id }, TEAM_FEE_ACER);
  const twiceEntry = await createEntryRows({
    team: twice.team,
    eventSlug: twiceSlug,
    actorUserId: twice.manager,
    seats: twice.seats,
    feeMinor: TEAM_FEE_MINOR,
  });
  if (!twiceEntry.ok) throw new Error("entry failed");

  const args = {
    owner: { teamId: twice.team.id },
    feeKey: teamEntryFeeKey(twiceEntry.entryId),
    refundKey: entryFeeRefundKey(twiceEntry.entryId),
    reference: `event:${twiceSlug}`,
  };
  const first = await refundEntryFee(args);
  const again = await refundEntryFee(args);
  console.log(`   first: ${first.outcome} ${first.amountMinor}; again: ${again.outcome} ${again.amountMinor}`);
  eq_("the first call refunds", first.outcome, "refunded");
  eq_("the second is a no-op success", again.outcome, "already_refunded");
  eq_("and credits nothing", again.amountMinor, 0);
  eq_("exactly one refund row", (await refundRows({ teamId: twice.team.id })).length, 1);
  eq_("the treasury holds the fee once", await getTeamAcerBalance(twice.team.id), TEAM_FEE_MINOR);

  /* ── 4. a free night withdrawn ────────────────────────────────── */
  console.log("\n4. withdrawing from a free night refunds nothing and does not error");
  const freeSlug = await makeEvent("free", { team: 0 });
  const free = await makeSquad("free");
  const freeEntry = await createEntryRows({
    team: free.team,
    eventSlug: freeSlug,
    actorUserId: free.manager,
    seats: free.seats,
    feeMinor: 0,
  });
  if (!freeEntry.ok) throw new Error("free entry failed");
  const freeRowsBefore = (await rowsOf({ teamId: free.team.id })).length;
  const freeMembers = await getEntryMembers(freeEntry.entryId);
  const freeWithdrawn = await withdrawEntryRows(
    freeEntry.entryId,
    freeMembers.map((m) => m.registrationId),
    { refundFee: true, actorUserId: free.manager },
  );
  check("withdrawal succeeded", freeWithdrawn.ok, JSON.stringify(freeWithdrawn));
  eq_("nothing was refunded", freeWithdrawn.ok ? freeWithdrawn.refundedMinor : -1, 0);
  eq_("no ledger row at all", (await rowsOf({ teamId: free.team.id })).length, freeRowsBefore);
  eq_("no refund row", (await refundRows({ teamId: free.team.id })).length, 0);
  eq_("the treasury is still empty", await getTeamAcerBalance(free.team.id), 0);

  /* ── 5. withdrawing after registration closed forfeits ────────── */
  console.log("\n5. withdrawing after registration closed refunds nothing");
  const shutSlug = await makeEvent("shut", {
    status: "registration_closed",
    team: TEAM_FEE_ACER,
  });
  const shut = await makeSquad("shut");
  await fund({ teamId: shut.team.id }, TEAM_FEE_ACER);
  const shutEntry = await createEntryRows({
    team: shut.team,
    eventSlug: shutSlug,
    actorUserId: shut.manager,
    seats: shut.seats,
    feeMinor: TEAM_FEE_MINOR,
  });
  if (!shutEntry.ok) throw new Error("entry failed");
  const shutAfterEntry = await getTeamAcerBalance(shut.team.id);
  const shutMembers = await getEntryMembers(shutEntry.entryId);
  const shutWithdrawn = await withdrawEntryRows(
    shutEntry.entryId,
    shutMembers.map((m) => m.registrationId),
    {
      refundFee: refundsOnWithdrawal({ status: "registration_closed" }),
      actorUserId: shut.manager,
    },
  );
  check("withdrawal succeeded", shutWithdrawn.ok, JSON.stringify(shutWithdrawn));
  console.log(
    `   treasury after entering: ${shutAfterEntry} minor; after withdrawing: ${await getTeamAcerBalance(shut.team.id)} minor`,
  );
  eq_("nothing was refunded", shutWithdrawn.ok ? shutWithdrawn.refundedMinor : -1, 0);
  eq_("no refund row", (await refundRows({ teamId: shut.team.id })).length, 0);
  eq_("the treasury is unchanged — the fee stays spent", await getTeamAcerBalance(shut.team.id), 0);
  eq_("the entry is still gone", (await getEntryMembers(shutEntry.entryId)).length, 0);

  /* ── 6. cancelling refunds every fee the night took ───────────── */
  console.log("\n6. cancelling a night refunds every team entry and every registration");
  const cancelSlug = await makeEvent("cancel", { team: TEAM_FEE_ACER, solo: SOLO_FEE_ACER });
  const cancelTeam = await makeSquad("cancel");
  await fund({ teamId: cancelTeam.team.id }, TEAM_FEE_ACER);
  const cancelEntry = await createEntryRows({
    team: cancelTeam.team,
    eventSlug: cancelSlug,
    actorUserId: cancelTeam.manager,
    seats: cancelTeam.seats,
    feeMinor: TEAM_FEE_MINOR,
  });
  if (!cancelEntry.ok) throw new Error("entry failed");

  const soloRunner = await makeUser("cancel-solo");
  await fund({ userId: soloRunner }, SOLO_FEE_ACER);
  const soloReg = await registerSolo(cancelSlug, soloRunner, SOLO_FEE_MINOR);
  console.log(
    `   treasury: ${await getTeamAcerBalance(cancelTeam.team.id)} minor; runner wallet: ${await getAcerBalance(soloRunner)} minor`,
  );
  eq_("the team paid", await getTeamAcerBalance(cancelTeam.team.id), 0);
  eq_("the runner paid", await getAcerBalance(soloRunner), 0);
  check(
    "the individual fee row is findable by the key this module spells",
    (await getWalletTransactionByKey({ userId: soloRunner }, individualEntryFeeKey(soloReg.id))) !==
      null,
  );

  const sweep = await refundEventFees(cancelSlug);
  console.log(`   sweep 1: ${JSON.stringify(sweep)}`);
  eq_("two fee rows found", sweep.found, 2);
  eq_("both refunded", sweep.refunded, 2);
  eq_("for the sum of both fees", sweep.refundedMinor, TEAM_FEE_MINOR + SOLO_FEE_MINOR);
  eq_("nothing failed or was skipped", [sweep.failed, sweep.skipped], [0, 0]);
  eq_("the treasury is whole", await getTeamAcerBalance(cancelTeam.team.id), TEAM_FEE_MINOR);
  eq_("the runner's wallet is whole", await getAcerBalance(soloRunner), SOLO_FEE_MINOR);
  eq_("one refund row on the team", (await refundRows({ teamId: cancelTeam.team.id })).length, 1);
  eq_("one refund row on the runner", (await refundRows({ userId: soloRunner })).length, 1);
  eq_(
    "the runner's refund is keyed by their registration",
    (await refundRows({ userId: soloRunner }))[0]?.idempotencyKey,
    entryFeeRefundKey(soloReg.id),
  );

  console.log("\n   and a second cancellation writes nothing");
  const sweep2 = await refundEventFees(cancelSlug);
  console.log(`   sweep 2: ${JSON.stringify(sweep2)}`);
  eq_("the same two fee rows are found", sweep2.found, 2);
  eq_("none is refunded again", sweep2.refunded, 0);
  eq_("no ACER moved", sweep2.refundedMinor, 0);
  eq_("both are reported as already refunded", sweep2.alreadyRefunded, 2);
  eq_("still one refund row on the team", (await refundRows({ teamId: cancelTeam.team.id })).length, 1);
  eq_("still one refund row on the runner", (await refundRows({ userId: soloRunner })).length, 1);
  eq_("the treasury did not double", await getTeamAcerBalance(cancelTeam.team.id), TEAM_FEE_MINOR);
  eq_("the wallet did not double", await getAcerBalance(soloRunner), SOLO_FEE_MINOR);

  console.log("\n   the balances reconcile as raw SUMs");
  console.log(
    `   team SUM = ${await rawBalance({ teamId: cancelTeam.team.id })} (want ${TEAM_FEE_MINOR}); runner SUM = ${await rawBalance({ userId: soloRunner })} (want ${SOLO_FEE_MINOR})`,
  );
  eq_("team SUM", await rawBalance({ teamId: cancelTeam.team.id }), TEAM_FEE_MINOR);
  eq_("runner SUM", await rawBalance({ userId: soloRunner }), SOLO_FEE_MINOR);

  /* ── 7. one paid and one comped participant ───────────────────── */
  console.log("\n7. a cancelled night with one paid and one comped runner refunds exactly one");
  const mixedSlug = await makeEvent("mixed", { solo: SOLO_FEE_ACER });
  const payer = await makeUser("mixed-payer");
  const comped = await makeUser("mixed-comped");
  await fund({ userId: payer }, SOLO_FEE_ACER);
  await registerSolo(mixedSlug, payer, SOLO_FEE_MINOR);
  // The admin comp path (ADR 0013): a hand-made registration, no consent, no
  // charge — and so nothing to give back.
  await createFreeRegistration({ eventSlug: mixedSlug, userId: comped, locale: "en" });
  eq_("the payer paid", await getAcerBalance(payer), 0);
  eq_("the comped runner paid nothing", await getAcerBalance(comped), 0);

  const mixedSweep = await refundEventFees(mixedSlug);
  console.log(`   sweep: ${JSON.stringify(mixedSweep)}`);
  eq_("one fee row found on a night with two participants", mixedSweep.found, 1);
  eq_("exactly one refund", mixedSweep.refunded, 1);
  eq_("for exactly the individual fee", mixedSweep.refundedMinor, SOLO_FEE_MINOR);
  eq_("the payer is whole", await getAcerBalance(payer), SOLO_FEE_MINOR);
  eq_("the comped runner is untouched", await getAcerBalance(comped), 0);
  eq_("no refund row on the comped runner", (await refundRows({ userId: comped })).length, 0);

  /* ── 8. a forfeited fee on a night that is then cancelled ─────── */
  console.log("\n8. a fee forfeited by a late withdrawal still comes back if the night is cancelled");
  console.log("   (the sweep reads the ledger, which remembers what the entry tables no longer do)");
  const shutSweep = await refundEventFees(shutSlug);
  console.log(`   sweep: ${JSON.stringify(shutSweep)}`);
  eq_("the forfeited fee row is still found", shutSweep.found, 1);
  eq_("and is refunded", shutSweep.refunded, 1);
  eq_("for exactly the team fee", shutSweep.refundedMinor, TEAM_FEE_MINOR);
  eq_("the treasury is whole again", await getTeamAcerBalance(shut.team.id), TEAM_FEE_MINOR);

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
