import { createHash } from "node:crypto";

import { and, desc, eq, gt, sql } from "drizzle-orm";
import { nanoid } from "nanoid";

import { users } from "@/db/schema/auth";
import {
  userTeamInvitations,
  userTeamMembers,
  userTeams,
  type UserTeamInvitationRow,
  type UserTeamRow,
} from "@/db/schema/user-teams";
import { getDb } from "@/lib/db";

import { INVITATION_TTL_DAYS, teamFailure, type TeamActionResult, type TeamSex } from "./config";
import { checkEligibility, type RosterSeat } from "./eligibility";
import { asTeamMailLocale, sendInvitationAcceptedEmail } from "./mail-invitations";

/**
 * Invitation mechanics: the token, the reads, and the one accept path.
 *
 * Deliberately **not** a `"use server"` module. `actions/invitations.ts` is the
 * action surface; everything here is plain server code, which is what lets
 * {@link acceptInvitationForUser} take arguments that are not client-serialisable
 * and stay un-callable over the wire. #61 imports
 * {@link getPendingInvitationForEmail} + {@link acceptInvitationForUser} so that
 * "a runner who holds a pending invitation and enters the code is accepted
 * through the invitation" (PRD #57) runs the *same* code as the link door.
 *
 * The token idiom is the legacy team login's: a raw `nanoid(32)` lives only in
 * the mailed link, the database holds its sha256, and a lookup hashes the
 * candidate and compares. A leaked database row therefore cannot be replayed as
 * a link.
 */

/** sha256 hex of the raw token — what `user_team_invitations.token_hash` holds. */
export function hashInvitationToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** A fresh token: the raw value for the link, the hash for the row. */
export function newInvitationToken(): { raw: string; hash: string } {
  const raw = nanoid(32);
  return { raw, hash: hashInvitationToken(raw) };
}

/** 30 days from now (`INVITATION_TTL_DAYS`). A resend resets this clock. */
export function invitationExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);
}

/** The locale-less path the raw token opens. */
export function invitePath(rawToken: string): string {
  return `/teams/invite/${rawToken}`;
}

/** An invitation always travels with its team — every screen needs both. */
export type InvitationWithTeam = {
  invitation: UserTeamInvitationRow;
  team: UserTeamRow;
};

/** Past its `expires_at`? Read at every use; the row is only flipped lazily. */
export function isInvitationExpired(
  invitation: Pick<UserTeamInvitationRow, "expiresAt">,
  now: Date = new Date(),
): boolean {
  return invitation.expiresAt.getTime() <= now.getTime();
}

/**
 * Resolve the raw token from a link. Returns `null` for an unknown token — the
 * caller renders "this link is not valid", never a 500.
 */
export async function getInvitationByToken(rawToken: string): Promise<InvitationWithTeam | null> {
  const raw = rawToken.trim();
  if (!raw) return null;
  const db = getDb();
  const rows = await db
    .select({ invitation: userTeamInvitations, team: userTeams })
    .from(userTeamInvitations)
    .innerJoin(userTeams, eq(userTeams.id, userTeamInvitations.teamId))
    .where(eq(userTeamInvitations.tokenHash, hashInvitationToken(raw)))
    .limit(1);
  return rows[0] ?? null;
}

/** Resolve by row id — the profile list's door, where no raw token exists. */
export async function getInvitationById(id: string): Promise<InvitationWithTeam | null> {
  const db = getDb();
  const rows = await db
    .select({ invitation: userTeamInvitations, team: userTeams })
    .from(userTeamInvitations)
    .innerJoin(userTeams, eq(userTeams.id, userTeamInvitations.teamId))
    .where(eq(userTeamInvitations.id, id))
    .limit(1);
  return rows[0] ?? null;
}

/** Open invitations for a team — pending and not yet expired, newest first. */
export async function listOpenInvitations(teamId: string): Promise<UserTeamInvitationRow[]> {
  const db = getDb();
  return db
    .select()
    .from(userTeamInvitations)
    .where(
      and(
        eq(userTeamInvitations.teamId, teamId),
        eq(userTeamInvitations.status, "pending"),
        gt(userTeamInvitations.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(userTeamInvitations.createdAt));
}

/**
 * The pending invitation this team already holds for an address, if any.
 * Case-insensitive, matching the partial unique index.
 *
 * Used by `inviteByEmail` to reissue rather than duplicate, and by #61 to admit
 * an invited runner through their invitation instead of filing a request.
 */
export async function getPendingInvitationForEmail(
  teamId: string,
  email: string,
): Promise<UserTeamInvitationRow | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(userTeamInvitations)
    .where(
      and(
        eq(userTeamInvitations.teamId, teamId),
        eq(userTeamInvitations.status, "pending"),
        sql`lower(${userTeamInvitations.email}) = lower(${email})`,
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Every open invitation addressed to one email, across teams — the profile's
 * "invitations waiting for you" list. Case-insensitive on purpose: the address
 * was typed by a manager, not picked from a list.
 */
export async function listOpenInvitationsForEmail(email: string): Promise<InvitationWithTeam[]> {
  const db = getDb();
  return db
    .select({ invitation: userTeamInvitations, team: userTeams })
    .from(userTeamInvitations)
    .innerJoin(userTeams, eq(userTeams.id, userTeamInvitations.teamId))
    .where(
      and(
        eq(userTeamInvitations.status, "pending"),
        gt(userTeamInvitations.expiresAt, new Date()),
        sql`lower(${userTeamInvitations.email}) = lower(${email})`,
      ),
    )
    .orderBy(desc(userTeamInvitations.createdAt));
}

/** Flip a row the read path found past its expiry. Idempotent. */
export async function markInvitationExpired(id: string): Promise<void> {
  const db = getDb();
  await db
    .update(userTeamInvitations)
    .set({ status: "expired" })
    .where(and(eq(userTeamInvitations.id, id), eq(userTeamInvitations.status, "pending")));
}

/** Decline: the row is closed, nothing is added to the roster. */
export async function declineInvitation(id: string): Promise<void> {
  const db = getDb();
  await db
    .update(userTeamInvitations)
    .set({ status: "declined", decidedAt: new Date() })
    .where(and(eq(userTeamInvitations.id, id), eq(userTeamInvitations.status, "pending")));
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

export type AcceptedInvitation = { teamSlug: string; teamName: string };

/**
 * Admit the runner through an invitation — **the one accept path**.
 *
 * Everything that decides happens inside a transaction that takes
 * `select … for update` on the invitation row *and* the team row, in that
 * order (the invitation is the narrower lock, and a team is never locked
 * first anywhere else, so no cycle exists). Under the lock it re-reads the
 * roster and re-runs `checkEligibility`, so a runner who joined another team in
 * this category between opening the link and pressing Accept is refused. The
 * `(user_id, category)` unique index is the backstop underneath.
 *
 * The manager's "someone joined" mail is sent **after** the commit and its
 * failure is logged, never thrown: a roster change that already happened must
 * not be rolled back by a mail server.
 *
 * @param invitationId the row to accept — resolved by the caller from a raw
 *   token, a row id the caller has already authorised, or a code (#61).
 * @param userId whichever signed-in account is accepting. It does **not** have
 *   to be the invited address (PRD #57: aliases and second addresses).
 */
export async function acceptInvitationForUser(
  invitationId: string,
  userId: string,
): Promise<TeamActionResult<AcceptedInvitation>> {
  const db = getDb();

  // A holder rather than plain `let`s: values assigned inside the transaction
  // callback are read after it commits.
  const state: {
    outcome: TeamActionResult<AcceptedInvitation>;
    mail: {
      team: UserTeamRow;
      memberName: string;
      count: number;
    } | null;
  } = { outcome: teamFailure("notfound"), mail: null };

  try {
    await db.transaction(async (tx) => {
      const [invitation] = await tx
        .select()
        .from(userTeamInvitations)
        .where(eq(userTeamInvitations.id, invitationId))
        .for("update");
      if (!invitation) {
        state.outcome = teamFailure("notfound");
        return;
      }

      const [team] = await tx
        .select()
        .from(userTeams)
        .where(eq(userTeams.id, invitation.teamId))
        .for("update");
      if (!team) {
        state.outcome = teamFailure("notfound");
        return;
      }

      if (invitation.status !== "pending") {
        state.outcome = teamFailure("used");
        return;
      }
      if (isInvitationExpired(invitation)) {
        await tx
          .update(userTeamInvitations)
          .set({ status: "expired" })
          .where(eq(userTeamInvitations.id, invitation.id));
        state.outcome = teamFailure("expired");
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
        .select({
          id: users.id,
          sex: users.sex,
          firstName: users.firstName,
          lastName: users.lastName,
          name: users.name,
          email: users.email,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      if (!candidate) {
        state.outcome = teamFailure("auth");
        return;
      }

      const held = await tx
        .select({ category: userTeamMembers.category })
        .from(userTeamMembers)
        .where(eq(userTeamMembers.userId, userId));

      const eligibility = checkEligibility(
        { category: team.category },
        roster,
        {
          userId,
          sex: (candidate.sex ?? null) as TeamSex | null,
          categories: held.map((row) => row.category),
        },
      );
      if (!eligibility.ok) {
        state.outcome = teamFailure(eligibility.reason);
        return;
      }

      await tx.insert(userTeamMembers).values({
        teamId: team.id,
        userId,
        role: "member",
        category: team.category,
      });
      await tx
        .update(userTeamInvitations)
        .set({ status: "accepted", acceptedByUserId: userId, decidedAt: new Date() })
        .where(eq(userTeamInvitations.id, invitation.id));

      state.mail = {
        team,
        memberName:
          [candidate.firstName, candidate.lastName].filter(Boolean).join(" ").trim() ||
          candidate.name ||
          candidate.email,
        count: roster.length + 1,
      };
      state.outcome = { ok: true, teamSlug: team.slug, teamName: team.name };
    });
  } catch (error) {
    // The index the transaction's own check should have caught first; a race
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
  if (mail) {
    const db2 = getDb();
    const [manager] = await db2
      .select({ email: users.email, locale: users.locale })
      .from(users)
      .where(eq(users.id, mail.team.managerUserId))
      .limit(1);
    if (manager) {
      await sendInvitationAcceptedEmail({
        to: manager.email,
        locale: asTeamMailLocale(manager.locale),
        team: mail.team,
        memberName: mail.memberName,
        count: mail.count,
      });
    }
  }

  return state.outcome;
}
