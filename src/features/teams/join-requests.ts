import { and, desc, eq } from "drizzle-orm";

import { users } from "@/db/schema/auth";
import {
  userTeamJoinRequests,
  userTeamMembers,
  userTeams,
  type UserTeamJoinRequestRow,
  type UserTeamRow,
} from "@/db/schema/user-teams";
import { getDb } from "@/lib/db";

import { teamFailure, type TeamActionResult, type TeamSex } from "./config";
import { checkEligibility, type RosterSeat } from "./eligibility";
import { asTeamMailLocale } from "./mail-invitations";
import { sendJoinRequestDecidedEmail } from "./mail-requests";

/**
 * Join-request mechanics: the reads, the insert and the one decide transaction.
 *
 * The mirror image of `invitations.ts`, and deliberately **not** a `"use server"`
 * module for the same reason: `actions/join-requests.ts` is the action surface,
 * everything here is plain server code that a client can never call and that may
 * therefore take arguments which are not client-serialisable.
 *
 * A join request carries no token. Knowing a **Team code** only lets a runner
 * knock (CONTEXT.md, *Team code*); the row that results references `team_id`, so
 * rotating the code afterwards leaves every pending request exactly where it was.
 */

/** A request always travels with its team — every screen needs both. */
export type JoinRequestWithTeam = {
  request: UserTeamJoinRequestRow;
  team: UserTeamRow;
};

/** One row of the manager's queue: the request plus who is knocking. */
export type PendingJoinRequest = {
  request: UserTeamJoinRequestRow;
  userId: string;
  /** First + last, falling back to the account name and then the email. */
  displayName: string;
};

/** Resolve a request row by id, with its team. `null` when it does not exist. */
export async function getJoinRequestById(id: string): Promise<JoinRequestWithTeam | null> {
  const db = getDb();
  const rows = await db
    .select({ request: userTeamJoinRequests, team: userTeams })
    .from(userTeamJoinRequests)
    .innerJoin(userTeams, eq(userTeams.id, userTeamJoinRequests.teamId))
    .where(eq(userTeamJoinRequests.id, id))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * The open request this runner already has at this team, if any — what the join
 * page reads to render "we have your request" instead of the button, and what
 * `requestToJoin` checks before trying an insert the partial unique index would
 * refuse anyway.
 */
export async function getPendingJoinRequest(
  teamId: string,
  userId: string,
): Promise<UserTeamJoinRequestRow | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(userTeamJoinRequests)
    .where(
      and(
        eq(userTeamJoinRequests.teamId, teamId),
        eq(userTeamJoinRequests.userId, userId),
        eq(userTeamJoinRequests.status, "pending"),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

/**
 * The manager's queue: pending requests for one team, newest first, each with
 * the runner's display name.
 *
 * This is a **member-side** read — the manager is deciding about a person and
 * needs to know who they are. The public surfaces (`/teams`, the join confirm
 * screen) never call it.
 */
export async function listPendingJoinRequests(teamId: string): Promise<PendingJoinRequest[]> {
  const db = getDb();
  const rows = await db
    .select({
      request: userTeamJoinRequests,
      firstName: users.firstName,
      lastName: users.lastName,
      name: users.name,
      email: users.email,
    })
    .from(userTeamJoinRequests)
    .innerJoin(users, eq(users.id, userTeamJoinRequests.userId))
    .where(
      and(eq(userTeamJoinRequests.teamId, teamId), eq(userTeamJoinRequests.status, "pending")),
    )
    .orderBy(desc(userTeamJoinRequests.createdAt));

  return rows.map((row) => ({
    request: row.request,
    userId: row.request.userId,
    displayName:
      [row.firstName, row.lastName].filter(Boolean).join(" ").trim() || row.name || row.email,
  }));
}

/** Every open request one runner has out, across teams — the profile's list. */
export async function listPendingJoinRequestsForUser(
  userId: string,
): Promise<JoinRequestWithTeam[]> {
  const db = getDb();
  return db
    .select({ request: userTeamJoinRequests, team: userTeams })
    .from(userTeamJoinRequests)
    .innerJoin(userTeams, eq(userTeams.id, userTeamJoinRequests.teamId))
    .where(and(eq(userTeamJoinRequests.userId, userId), eq(userTeamJoinRequests.status, "pending")))
    .orderBy(desc(userTeamJoinRequests.createdAt));
}

/** Postgres unique-violation, optionally on one named constraint. */
function isUniqueViolation(error: unknown, constraint?: string): boolean {
  const code = (error as { code?: string })?.code;
  if (code !== "23505") return false;
  if (!constraint) return true;
  const detail = `${(error as { constraint_name?: string }).constraint_name ?? ""} ${
    (error as { constraint?: string }).constraint ?? ""
  } ${(error as { message?: string }).message ?? ""}`;
  return detail.includes(constraint);
}

/**
 * File the request. Eligibility is the caller's job and has already run — this
 * is only the row.
 *
 * `user_team_join_requests_team_user_pending_uq` is partial on `status =
 * 'pending'`, which is what makes "one open request per runner per team" a
 * database fact while leaving the declined and withdrawn history in place: a
 * runner a manager turned down may knock again, and gets a **new row**.
 *
 * The unique violation is reported as `used` — "you have already knocked" — for
 * want of a truer `TeamActionReason` (the set is frozen by PRD #57). The join
 * page pre-reads {@link getPendingJoinRequest} and renders the pending state
 * instead of the button, so reaching this arm means two presses raced.
 */
export async function createJoinRequest(
  teamId: string,
  userId: string,
): Promise<TeamActionResult<{ requestId: string }>> {
  const db = getDb();
  try {
    const [row] = await db
      .insert(userTeamJoinRequests)
      .values({ teamId, userId, status: "pending" })
      .returning({ id: userTeamJoinRequests.id });
    return { ok: true, requestId: row.id };
  } catch (error) {
    if (isUniqueViolation(error, "user_team_join_requests_team_user_pending_uq")) {
      return teamFailure("used");
    }
    throw error;
  }
}

/** Withdraw: the runner takes their own knock back. Only affects a pending row. */
export async function withdrawJoinRequestRow(id: string): Promise<void> {
  const db = getDb();
  await db
    .update(userTeamJoinRequests)
    .set({ status: "withdrawn", decidedAt: new Date() })
    .where(and(eq(userTeamJoinRequests.id, id), eq(userTeamJoinRequests.status, "pending")));
}

export type DecidedJoinRequest = {
  teamSlug: string;
  teamName: string;
  decision: "accept" | "decline";
};

/**
 * Accept or decline — **the one decide path**, called by the action once the
 * manager-or-admin gate has passed.
 *
 * Accept runs inside a transaction that takes `select … for update` on the
 * request row and then on the team row, in that order — the same order
 * `acceptInvitationForUser` uses, so the two doors can never deadlock against
 * each other. Under the lock it re-reads the roster and re-runs
 * `checkEligibility`; the `(user_id, category)` unique index is the backstop
 * underneath. The runner may have joined another team in this category between
 * knocking and being let in, and that is exactly what the re-check is for.
 *
 * Decline is a single update. Either way the row records
 * `decided_by_user_id` + `decided_at`, and the runner is mailed **after** the
 * commit, failure logged only: a roster change that already happened must not be
 * rolled back by a mail server.
 */
export async function decideJoinRequestForManager(
  requestId: string,
  decision: "accept" | "decline",
  deciderUserId: string,
): Promise<TeamActionResult<DecidedJoinRequest>> {
  const db = getDb();

  // A holder rather than plain `let`s: values assigned inside the transaction
  // callback are read after it commits.
  const state: {
    outcome: TeamActionResult<DecidedJoinRequest>;
    mail: {
      team: UserTeamRow;
      runnerUserId: string;
      count: number;
    } | null;
  } = { outcome: teamFailure("notfound"), mail: null };

  try {
    await db.transaction(async (tx) => {
      const [request] = await tx
        .select()
        .from(userTeamJoinRequests)
        .where(eq(userTeamJoinRequests.id, requestId))
        .for("update");
      if (!request) {
        state.outcome = teamFailure("notfound");
        return;
      }

      const [team] = await tx
        .select()
        .from(userTeams)
        .where(eq(userTeams.id, request.teamId))
        .for("update");
      if (!team) {
        state.outcome = teamFailure("notfound");
        return;
      }

      if (request.status !== "pending") {
        state.outcome = teamFailure("used");
        return;
      }

      if (decision === "decline") {
        await tx
          .update(userTeamJoinRequests)
          .set({ status: "declined", decidedByUserId: deciderUserId, decidedAt: new Date() })
          .where(eq(userTeamJoinRequests.id, request.id));
        state.mail = { team, runnerUserId: request.userId, count: 0 };
        state.outcome = { ok: true, teamSlug: team.slug, teamName: team.name, decision };
        return;
      }

      const seatRows = await tx
        .select({ userId: userTeamMembers.userId, role: userTeamMembers.role, sex: users.sex })
        .from(userTeamMembers)
        .innerJoin(users, eq(users.id, userTeamMembers.userId))
        .where(eq(userTeamMembers.teamId, team.id));
      const roster: RosterSeat[] = seatRows.map((row) => ({
        userId: row.userId,
        role: row.role,
        sex: (row.sex ?? null) as TeamSex | null,
      }));

      const [candidate] = await tx
        .select({ id: users.id, sex: users.sex })
        .from(users)
        .where(eq(users.id, request.userId))
        .limit(1);
      if (!candidate) {
        state.outcome = teamFailure("notfound");
        return;
      }

      const held = await tx
        .select({ category: userTeamMembers.category })
        .from(userTeamMembers)
        .where(eq(userTeamMembers.userId, request.userId));

      const candidateSex = (candidate.sex ?? null) as TeamSex | null;
      const eligibility = checkEligibility({ category: team.category }, roster, {
        userId: request.userId,
        sex: candidateSex,
        categories: held.map((row) => row.category),
      });
      if (!eligibility.ok) {
        state.outcome = teamFailure(eligibility.reason);
        return;
      }

      await tx.insert(userTeamMembers).values({
        teamId: team.id,
        userId: request.userId,
        role: "member",
        category: team.category,
      });
      await tx
        .update(userTeamJoinRequests)
        .set({ status: "accepted", decidedByUserId: deciderUserId, decidedAt: new Date() })
        .where(eq(userTeamJoinRequests.id, request.id));

      state.mail = {
        team,
        runnerUserId: request.userId,
        count: roster.length + 1,
      };
      state.outcome = { ok: true, teamSlug: team.slug, teamName: team.name, decision };
    });
  } catch (error) {
    // The indexes the transaction's own check should have caught first; a race
    // between two teams in the same category can still land here.
    if (isUniqueViolation(error, "user_team_members_user_category_uq")) {
      return teamFailure("already_in_category");
    }
    if (isUniqueViolation(error, "user_team_members_team_user_uq")) {
      return teamFailure("already_member");
    }
    throw error;
  }

  const mail = state.mail;
  if (mail && state.outcome.ok) {
    const [runner] = await getDb()
      .select({
        email: users.email,
        locale: users.locale,
        firstName: users.firstName,
        name: users.name,
      })
      .from(users)
      .where(eq(users.id, mail.runnerUserId))
      .limit(1);
    if (runner) {
      await sendJoinRequestDecidedEmail({
        to: runner.email,
        locale: asTeamMailLocale(runner.locale),
        team: mail.team,
        firstName: runner.firstName?.trim() || runner.name.split(" ")[0] || runner.email,
        accepted: decision === "accept",
        count: mail.count,
      });
    }
  }

  return state.outcome;
}
