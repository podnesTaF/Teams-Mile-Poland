import { and, eq } from "drizzle-orm";

import { users } from "@/db/schema/auth";
import { userTeamMembers, userTeams, type UserTeamRow } from "@/db/schema/user-teams";
import { getDb } from "@/lib/db";

import { teamFailure, type TeamActionResult } from "./config";
import { getTeamMembership, getTeamRoster } from "./data";

/**
 * The row-level half of the roster-change actions (#62): leave, remove, hand
 * over, dissolve. Everything here is **already past the gate** — the actions in
 * `actions/roster.ts` run `requireTeamActor` / `requireTeamManagerOrAdmin` and
 * then call these with the team row they were handed.
 *
 * The split exists so the transaction bodies can be exercised directly from a
 * verification script without forging a session, and so `actions/roster.ts`
 * stays a thin "gate → service → mail → result" file. It is **not** a
 * `"use server"` module: it exports types and non-action helpers.
 *
 * Hard operations, no soft state (PRD #57, "Hard operations, no soft state"):
 * there is no `dissolved` status and no `left_at`. Dissolve deletes the team row
 * and the database cascades memberships, invitations and join requests.
 */

/** Who an outgoing roster email goes to, in the language that account reads. */
export type TeamMailRecipient = {
  userId: string;
  email: string;
  /** First + last, falling back to the account name and then the address. */
  displayName: string;
  /** First name alone, for the greeting. */
  firstName: string;
  /** `users.locale` verbatim; `asTeamMailLocale` narrows it at the send site. */
  locale: string;
};

function toRecipient(row: {
  id: string;
  email: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  locale: string;
}): TeamMailRecipient {
  const displayName =
    [row.firstName, row.lastName].filter(Boolean).join(" ").trim() || row.name || row.email;
  return {
    userId: row.id,
    email: row.email,
    displayName,
    firstName: row.firstName?.trim() || displayName.split(" ")[0] || row.email,
    locale: row.locale,
  };
}

/**
 * Mail details for one account. Separate from `getTeamRoster` because that
 * helper deliberately carries no locale — it feeds the on-page roster, not mail.
 */
export async function getTeamMailRecipient(userId: string): Promise<TeamMailRecipient | null> {
  const db = getDb();
  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      firstName: users.firstName,
      lastName: users.lastName,
      locale: users.locale,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row ? toRecipient(row) : null;
}

/** Mail details for the whole roster, in join order. Read *before* a delete. */
export async function getTeamMailRecipients(teamId: string): Promise<TeamMailRecipient[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      firstName: users.firstName,
      lastName: users.lastName,
      locale: users.locale,
      joinedAt: userTeamMembers.joinedAt,
    })
    .from(userTeamMembers)
    .innerJoin(users, eq(users.id, userTeamMembers.userId))
    .where(eq(userTeamMembers.teamId, teamId))
    .orderBy(userTeamMembers.joinedAt);
  return rows.map(toRecipient);
}

/**
 * Leave, for a runner who is on the roster.
 *
 * Three outcomes, and only three:
 *  - a plain member's seat is deleted;
 *  - the manager **with other members still on the roster** is refused with
 *    `manager_must_hand_over` — a team is never left without a manager;
 *  - the manager who is the **sole member** takes the team with them, which is
 *    the same operation as dissolve (PRD #57: "A manager who is the last member
 *    leaving is the same as dissolve").
 *
 * Leaving sends no email: the manager sees the roster change, and mailing a
 * runner about their own click is noise.
 */
export async function leaveTeamRows(
  team: UserTeamRow,
  userId: string,
): Promise<TeamActionResult<{ teamDeleted: boolean }>> {
  const membership = await getTeamMembership(team.id, userId);
  if (!membership) return teamFailure("notfound");

  const db = getDb();
  const isManager = team.managerUserId === userId || membership.role === "manager";

  if (isManager) {
    const roster = await getTeamRoster(team.id);
    if (roster.length > 1) return teamFailure("manager_must_hand_over");
    // Sole member: deleting the team cascades this last membership away.
    await db.delete(userTeams).where(eq(userTeams.id, team.id));
    return { ok: true, teamDeleted: true };
  }

  await db
    .delete(userTeamMembers)
    .where(and(eq(userTeamMembers.teamId, team.id), eq(userTeamMembers.userId, userId)));
  return { ok: true, teamDeleted: false };
}

/**
 * Remove another member. The manager cannot be removed — hand over first, which
 * is what `invalid` points at — and a target who is not on the roster is
 * `notfound` rather than a silent success.
 *
 * Returns the removed runner's mail details, read before the delete.
 */
export async function removeMemberRows(
  team: UserTeamRow,
  targetUserId: string,
): Promise<TeamActionResult<{ removed: TeamMailRecipient }>> {
  if (targetUserId === team.managerUserId) return teamFailure("invalid");

  const membership = await getTeamMembership(team.id, targetUserId);
  if (!membership) return teamFailure("notfound");
  if (membership.role === "manager") return teamFailure("invalid");

  const removed = await getTeamMailRecipient(targetUserId);
  if (!removed) return teamFailure("notfound");

  const db = getDb();
  await db
    .delete(userTeamMembers)
    .where(and(eq(userTeamMembers.teamId, team.id), eq(userTeamMembers.userId, targetUserId)));

  return { ok: true, removed };
}

/**
 * Hand management to another member: the target's seat becomes `manager`, the
 * outgoing manager's becomes `member`, and `user_teams.manager_user_id` moves —
 * **all three in one transaction**. Any two of them without the third leaves a
 * team with no manager or with two, and both are unrecoverable from the UI.
 *
 * The target must already be on the roster: hand-over is not a way to add
 * someone, so it never runs `checkEligibility`.
 */
export async function handOverManagementRows(
  team: UserTeamRow,
  targetUserId: string,
): Promise<TeamActionResult<{ newManager: TeamMailRecipient; previousManagerUserId: string }>> {
  if (targetUserId === team.managerUserId) return teamFailure("invalid");

  const membership = await getTeamMembership(team.id, targetUserId);
  if (!membership) return teamFailure("notfound");

  const newManager = await getTeamMailRecipient(targetUserId);
  if (!newManager) return teamFailure("notfound");

  const previousManagerUserId = team.managerUserId;
  const db = getDb();

  await db.transaction(async (tx) => {
    await tx
      .update(userTeamMembers)
      .set({ role: "member" })
      .where(
        and(
          eq(userTeamMembers.teamId, team.id),
          eq(userTeamMembers.userId, previousManagerUserId),
        ),
      );
    await tx
      .update(userTeamMembers)
      .set({ role: "manager" })
      .where(and(eq(userTeamMembers.teamId, team.id), eq(userTeamMembers.userId, targetUserId)));
    await tx
      .update(userTeams)
      .set({ managerUserId: targetUserId, updatedAt: new Date() })
      .where(eq(userTeams.id, team.id));
  });

  return { ok: true, newManager, previousManagerUserId };
}

/**
 * Dissolve: one delete of the team row. Memberships, invitations and join
 * requests go with it through `on delete cascade`, and the slug and code stop
 * resolving immediately. Nothing references a team yet, so there is nothing to
 * orphan (PRD #57, Cross-Cutting Decision 5).
 *
 * Returns everyone who must be told — the roster minus the actor, read before
 * the delete. An admin acting for the team is not on the roster, so the filter
 * is a no-op there and every member hears about it.
 */
export async function dissolveTeamRows(
  team: UserTeamRow,
  actorUserId: string,
): Promise<TeamActionResult<{ recipients: TeamMailRecipient[] }>> {
  const recipients = (await getTeamMailRecipients(team.id)).filter(
    (member) => member.userId !== actorUserId,
  );

  const db = getDb();
  await db.delete(userTeams).where(eq(userTeams.id, team.id));

  return { ok: true, recipients };
}
