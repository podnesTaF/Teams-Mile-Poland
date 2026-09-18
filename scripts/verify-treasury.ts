/**
 * DB round-trip for the team treasury (ADR 0012).
 *
 *   ALLOW_FIXTURES=1 npx tsx --env-file=.env.local scripts/verify-treasury.ts
 *   ALLOW_FIXTURES=1 npx tsx --env-file=.env.local scripts/verify-treasury.ts --teardown
 *
 * Writes to whatever `DATABASE_URL` points at, so it refuses to run without
 * `ALLOW_FIXTURES=1` (`scripts/lib/guard.ts`). Needs migration 0027 applied.
 *
 * What it proves, against the real data layer rather than a mock: a
 * contribution and a payout each write exactly two legs that net to zero; a
 * replayed form is a no-op and a changed one is refused; a shortfall writes
 * nothing; concurrent spends by one payer never overdraw; a contribution and
 * a payout racing on the same team never deadlock and conserve ACER; a payout
 * reaches only a current member; the check constraint refuses a row with no
 * owner or two; a dissolved team's rows survive; and the user-keyed reads
 * return what they did before treasuries existed.
 *
 * Every fixture is prefixed `tre-` and every delete is scoped to ids this
 * script created. Nothing here imports anything that sends mail.
 */
import { and, eq, inArray, like, or, sql } from "drizzle-orm";

import { users, userTeamMembers, userTeams, walletTransactions } from "../src/db/schema";
import { reverseRows } from "../src/features/admin/wallet-reverse";
import { removeMemberRows } from "../src/features/teams/roster-service";
import { contributeRows, payoutRows } from "../src/features/teams/treasury";
import { acerToMinor } from "../src/features/wallet/config";
import {
  getAcerBalance,
  getTeamAcerBalance,
  getWalletBalances,
  listWalletTransactions,
  recordWalletTransaction,
} from "../src/features/wallet/data";
import {
  isInsufficientAcer,
  isStaleTransfer,
  isWalletOwnerNotFound,
  transferAssertionCode,
} from "../src/features/wallet/errors";
import { transferKey } from "../src/features/wallet/transfers";
import { getDb } from "../src/lib/db";
import { requireFixtureConsent } from "./lib/guard";

requireFixtureConsent("scripts/verify-treasury.ts");

const PREFIX = "tre-";

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

const uuid = () => crypto.randomUUID();

async function makeUser(suffix: string): Promise<string> {
  const id = `${PREFIX}${suffix}`;
  await getDb()
    .insert(users)
    .values({
      id,
      name: `Treasury ${suffix}`,
      firstName: `T${suffix}`,
      lastName: "Fixture",
      email: `${id}@example.test`,
      emailVerified: true,
    });
  return id;
}

async function makeTeam(suffix: string, managerUserId: string) {
  const [team] = await getDb()
    .insert(userTeams)
    .values({
      slug: `${PREFIX}${suffix}`,
      code: `T${suffix.toUpperCase().slice(0, 5)}`,
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

async function addMember(teamId: string, userId: string) {
  await getDb().insert(userTeamMembers).values({ teamId, userId, role: "member", category: "men" });
}

async function grant(userId: string, acer: number) {
  await recordWalletTransaction({
    userId,
    asset: "ACER",
    amountMinor: acerToMinor(acer),
    kind: "admin_credit",
    memo: "fixture",
  });
}

async function rowsFor(where: ReturnType<typeof eq>) {
  return getDb()
    .select()
    .from(walletTransactions)
    .where(where)
    .orderBy(walletTransactions.createdAt, walletTransactions.id);
}

async function countAll(): Promise<number> {
  const [row] = await getDb()
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(walletTransactions)
    .where(
      or(
        like(walletTransactions.userId, `${PREFIX}%`),
        like(walletTransactions.createdBy, `${PREFIX}%`),
      ),
    );
  return row?.n ?? 0;
}

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
  // Team rows carry no FK, so they are found through `created_by` (every
  // treasury row is written by a fixture user) rather than through the team.
  await db
    .delete(walletTransactions)
    .where(
      or(
        userIds.length ? inArray(walletTransactions.userId, userIds) : sql`false`,
        userIds.length ? inArray(walletTransactions.createdBy, userIds) : sql`false`,
        teamIds.length ? inArray(walletTransactions.teamId, teamIds) : sql`false`,
      ),
    );
  if (teamIds.length) await db.delete(userTeams).where(inArray(userTeams.id, teamIds));
  if (userIds.length) await db.delete(users).where(inArray(users.id, userIds));
  if (!quiet) console.log(`tore down ${userIds.length} users, ${teamIds.length} teams`);
}

async function run() {
  await teardown(true);

  const manager = await makeUser("manager");
  const member = await makeUser("member");
  const stranger = await makeUser("stranger");
  const team = await makeTeam("team", manager);
  await addMember(team.id, member);
  await grant(member, 50);

  /* ── 1. a contribution is two legs ─────────────────────────────── */
  console.log("\n1. contribution writes two legs");
  const c1 = uuid();
  const out1 = await contributeRows({
    team,
    amountMinor: acerToMinor(30),
    actorUserId: member,
    transferId: c1,
  });
  eq_("first press is new", out1.alreadyRecorded, false);
  const memberRows = await rowsFor(eq(walletTransactions.userId, member));
  const teamRows = await rowsFor(eq(walletTransactions.teamId, team.id));
  eq_("member has grant + one leg", memberRows.length, 2);
  eq_("team has one leg", teamRows.length, 1);
  const outLeg = memberRows[1];
  const inLeg = teamRows[0];
  eq_("out leg is −30", outLeg?.amountMinor, -3000);
  eq_("in leg is +30", inLeg?.amountMinor, 3000);
  eq_(
    "both legs share the kind",
    [outLeg?.kind, inLeg?.kind],
    ["treasury_contribution", "treasury_contribution"],
  );
  eq_("out leg keyed :out", outLeg?.idempotencyKey, transferKey(c1, "out"));
  eq_("in leg keyed :in", inLeg?.idempotencyKey, transferKey(c1, "in"));
  eq_("both legs record the actor", [outLeg?.createdBy, inLeg?.createdBy], [member, member]);
  eq_("out leg points at the team", outLeg?.reference, `team:${team.slug}`);
  eq_("in leg points at the member", inLeg?.reference, `user:${member}`);
  eq_("in leg has no user owner", inLeg?.userId, null);
  eq_("member balance 20", await getAcerBalance(member), 2000);
  eq_("treasury 30", await getTeamAcerBalance(team.id), 3000);

  /* ── 2. replay ─────────────────────────────────────────────────── */
  console.log("\n2. replayed form");
  const before = await countAll();
  const replay = await contributeRows({
    team,
    amountMinor: acerToMinor(30),
    actorUserId: member,
    transferId: c1,
  });
  eq_("reported as already recorded", replay.alreadyRecorded, true);
  eq_("no new rows", await countAll(), before);
  await expectThrow(
    "same id with a different amount is stale",
    () =>
      contributeRows({ team, amountMinor: acerToMinor(10), actorUserId: member, transferId: c1 }),
    isStaleTransfer,
  );
  eq_("still no new rows", await countAll(), before);

  /* ── 3. shortfall ──────────────────────────────────────────────── */
  console.log("\n3. shortfall");
  await expectThrow(
    "contribution above balance is refused",
    () =>
      contributeRows({
        team,
        amountMinor: acerToMinor(100),
        actorUserId: member,
        transferId: uuid(),
      }),
    isInsufficientAcer,
  );
  eq_("nothing written", await countAll(), before);

  /* ── 4. concurrent spends by one payer ─────────────────────────── */
  console.log("\n4. two concurrent contributions from a 20 ACER wallet");
  const results = await Promise.allSettled([
    contributeRows({ team, amountMinor: acerToMinor(15), actorUserId: member, transferId: uuid() }),
    contributeRows({ team, amountMinor: acerToMinor(15), actorUserId: member, transferId: uuid() }),
  ]);
  eq_("exactly one succeeded", results.filter((r) => r.status === "fulfilled").length, 1);
  check(
    "the other was a shortfall",
    results.some((r) => r.status === "rejected" && isInsufficientAcer(r.reason)),
  );
  eq_("member balance 5", await getAcerBalance(member), 500);
  eq_("treasury 45", await getTeamAcerBalance(team.id), 4500);

  /* ── 5. payout ─────────────────────────────────────────────────── */
  console.log("\n5. payout");
  const p1 = uuid();
  const pay = await payoutRows({
    team,
    memberUserId: member,
    amountMinor: acerToMinor(10),
    actorUserId: manager,
    transferId: p1,
  });
  eq_("payout is new", pay.alreadyRecorded, false);
  eq_("treasury 35", await getTeamAcerBalance(team.id), 3500);
  eq_("member balance 15", await getAcerBalance(member), 1500);
  const payLeg = (await rowsFor(eq(walletTransactions.idempotencyKey, transferKey(p1, "out"))))[0];
  eq_(
    "payout out leg is the team's",
    [payLeg?.teamId, payLeg?.userId, payLeg?.kind],
    [team.id, null, "treasury_payout"],
  );
  eq_("payout out leg recorded by the manager", payLeg?.createdBy, manager);
  await expectThrow(
    "payout to a stranger is refused",
    () =>
      payoutRows({
        team,
        memberUserId: stranger,
        amountMinor: acerToMinor(1),
        actorUserId: manager,
        transferId: uuid(),
      }),
    (e) => transferAssertionCode(e) === "not_a_member",
  );
  const two = await Promise.allSettled([
    payoutRows({
      team,
      memberUserId: member,
      amountMinor: acerToMinor(30),
      actorUserId: manager,
      transferId: uuid(),
    }),
    payoutRows({
      team,
      memberUserId: member,
      amountMinor: acerToMinor(30),
      actorUserId: manager,
      transferId: uuid(),
    }),
  ]);
  eq_(
    "two concurrent payouts exceeding the treasury: one succeeds",
    two.filter((r) => r.status === "fulfilled").length,
    1,
  );
  eq_("treasury 5", await getTeamAcerBalance(team.id), 500);

  /* ── 6. contribution vs payout race, conservation ──────────────── */
  console.log("\n6. contribution and payout racing on one team, 20 rounds");
  await grant(member, 100);
  let deadlocks = 0;
  for (let i = 0; i < 20; i++) {
    const settled = await Promise.allSettled([
      contributeRows({
        team,
        amountMinor: acerToMinor(2),
        actorUserId: member,
        transferId: uuid(),
      }),
      payoutRows({
        team,
        memberUserId: member,
        amountMinor: acerToMinor(1),
        actorUserId: manager,
        transferId: uuid(),
      }),
    ]);
    for (const r of settled) {
      if (r.status === "rejected" && /deadlock|40P01/i.test(String(r.reason))) deadlocks += 1;
    }
  }
  eq_("no deadlocks", deadlocks, 0);
  const [conservation] = await getDb()
    .select({
      total: sql<number>`coalesce(sum(${walletTransactions.amountMinor}), 0)`.mapWith(Number),
    })
    .from(walletTransactions)
    .where(
      and(
        inArray(walletTransactions.kind, ["treasury_contribution", "treasury_payout"]),
        like(walletTransactions.createdBy, `${PREFIX}%`),
      ),
    );
  eq_("treasury legs sum to zero", conservation?.total, 0);

  /* ── 7. payout after removal ───────────────────────────────────── */
  console.log("\n7. payout after the member is removed");
  const removed = await removeMemberRows(team, member);
  eq_("member removed", removed.ok, true);
  await expectThrow(
    "payout to an ex-member is refused",
    () =>
      payoutRows({
        team,
        memberUserId: member,
        amountMinor: acerToMinor(1),
        actorUserId: manager,
        transferId: uuid(),
      }),
    (e) => transferAssertionCode(e) === "not_a_member",
  );

  /* ── 8. the check constraint ───────────────────────────────────── */
  console.log("\n8. one owner per row");
  const raw = (values: Record<string, unknown>) =>
    getDb()
      .insert(walletTransactions)
      .values({ asset: "ACER", amountMinor: 1, kind: "admin_credit", ...values } as never);
  await expectThrow(
    "no owner is refused",
    () => raw({}),
    (e) =>
      /23514|wallet_tx_one_owner/.test(
        JSON.stringify(e, Object.getOwnPropertyNames(e as object)),
      ) || String((e as { cause?: { code?: string } })?.cause?.code) === "23514",
  );
  await expectThrow(
    "two owners is refused",
    () => raw({ userId: member, teamId: team.id }),
    (e) =>
      /23514|wallet_tx_one_owner/.test(
        JSON.stringify(e, Object.getOwnPropertyNames(e as object)),
      ) || String((e as { cause?: { code?: string } })?.cause?.code) === "23514",
  );

  /* ── 9. legacy reads unchanged ─────────────────────────────────── */
  console.log("\n9. user-keyed reads");
  const balances = await getWalletBalances(member);
  eq_("getWalletBalances(userId) still answers", balances.ACER, await getAcerBalance(member));
  const history = await listWalletTransactions(member, { pageSize: 100 });
  check(
    "history lists only the member's own rows",
    history.rows.every((r) => r.userId === member),
  );
  const teamHistory = await listWalletTransactions({ teamId: team.id }, { pageSize: 100 });
  check(
    "team history lists only the team's rows",
    teamHistory.rows.every((r) => r.teamId === team.id && r.userId === null),
  );

  /* ── 9b. reversal of a transfer is two legs ────────────────────── */
  console.log("\n9b. reversing one leg reverses the transfer");
  const c9 = uuid();
  await addMember(team.id, member);
  await contributeRows({ team, amountMinor: acerToMinor(3), actorUserId: member, transferId: c9 });
  const memberBefore = await getAcerBalance(member);
  const teamBefore9 = await getTeamAcerBalance(team.id);
  const legRow = (await rowsFor(eq(walletTransactions.idempotencyKey, transferKey(c9, "in"))))[0];
  const rev = await reverseRows({
    txId: legRow!.id,
    reason: "fixture correction",
    adminId: manager,
  });
  eq_("reversal reports two legs", rev.ok && rev.legs, 2);
  eq_("reversal reports reversed", rev.ok && rev.reversed, true);
  eq_("member refunded", await getAcerBalance(member), memberBefore + 300);
  eq_("treasury debited", await getTeamAcerBalance(team.id), teamBefore9 - 300);
  const reversals = await rowsFor(eq(walletTransactions.kind, "reversal"));
  eq_("two reversal rows, one per leg", reversals.filter((r) => r.createdBy === manager).length, 2);
  check(
    "each reversal points at its leg",
    reversals.every((r) => r.reversesId !== null),
  );
  const again = await reverseRows({ txId: legRow!.id, reason: "again", adminId: manager });
  eq_("second reversal is a no-op", again.ok && again.reversed, false);
  eq_(
    "no third reversal row",
    (await rowsFor(eq(walletTransactions.kind, "reversal"))).length,
    reversals.length,
  );
  const plainGrant = await recordWalletTransaction({
    teamId: team.id,
    asset: "ACER",
    amountMinor: 100,
    kind: "admin_credit",
    memo: "fixture grant",
    createdBy: manager,
  });
  const revGrant = await reverseRows({
    txId: plainGrant!.id,
    reason: "undo grant",
    adminId: manager,
  });
  eq_("a plain team grant reverses as one leg", revGrant.ok && revGrant.legs, 1);
  eq_("treasury back where it was", await getTeamAcerBalance(team.id), teamBefore9 - 300);

  /* ── 10. dissolve ──────────────────────────────────────────────── */
  console.log("\n10. dissolve leaves the treasury rows");
  const treasuryBefore = await getTeamAcerBalance(team.id);
  const teamRowsBefore = (await rowsFor(eq(walletTransactions.teamId, team.id))).length;
  await getDb().delete(userTeams).where(eq(userTeams.id, team.id));
  eq_(
    "rows survive the delete",
    (await rowsFor(eq(walletTransactions.teamId, team.id))).length,
    teamRowsBefore,
  );
  eq_("balance still sums", await getTeamAcerBalance(team.id), treasuryBefore);
  await expectThrow(
    "a contribution to the dissolved team is refused",
    () =>
      contributeRows({
        team,
        amountMinor: acerToMinor(1),
        actorUserId: member,
        transferId: uuid(),
      }),
    isWalletOwnerNotFound,
  );

  console.log(`\n${pass} passed, ${fail} failed`);
  await teardown();
  // The pool keeps the event loop alive; say so explicitly rather than hang.
  process.exit(fail > 0 ? 1 : 0);
}

if (process.argv.includes("--teardown")) {
  teardown().then(() => process.exit(0));
} else {
  run().catch(async (error) => {
    console.error(error);
    await teardown(true).catch(() => undefined);
    process.exit(1);
  });
}
