"use server";

import { teamFailure, type TeamActionResult } from "../config";
import { getTeamBySlug } from "../data";
import { requireTeamActor, requireTeamManagerOrAdmin } from "../guards";
import {
  sendManagementHandedOverMail,
  sendRemovedFromTeamMail,
  sendTeamDissolvedMail,
} from "../mail-roster";
import {
  dissolveTeamRows,
  handOverManagementRows,
  leaveTeamRows,
  removeMemberRows,
} from "../roster-service";

/**
 * Roster changes after joining (#62): leave, remove, hand over management,
 * dissolve. Every export returns the frozen `{ ok: true, … } | { ok: false,
 * reason, message }` shape and never throws for an expected refusal.
 *
 * The gate differs by action on purpose:
 *  - `leaveTeam` runs `requireTeamActor` — a plain member leaving is not a
 *    manager operation, and gating it on the manager would make leaving
 *    impossible for everyone it is for;
 *  - the other three run `requireTeamManagerOrAdmin`, which already lets an
 *    admin holding `edit` act for any team and refuses `admin_checkin` /
 *    `admin_viewer` with `forbidden` (PRD #57, user story 54 and 55).
 *
 * The row work lives in `../roster-service`; these functions are gate → service
 * → mail → result. Mail is sent **after** the write and its failure never
 * changes the result: the roster has already moved, and telling the presser
 * their removal failed would be a lie.
 */

export async function leaveTeam(slug: string): Promise<TeamActionResult<{ teamDeleted: boolean }>> {
  const actor = await requireTeamActor();
  if (!actor.ok) return actor;

  const team = await getTeamBySlug(slug);
  if (!team) return teamFailure("notfound");

  // No email: the runner pressed the button, and the manager sees the roster
  // change (PRD #57, "Leaving sends no email").
  return leaveTeamRows(team, actor.userId);
}

/**
 * Remove another member. The manager cannot be the target — hand over first —
 * and a target who is not on the roster is refused rather than silently
 * succeeding.
 */
export async function removeMember(slug: string, userId: string): Promise<TeamActionResult> {
  const gate = await requireTeamManagerOrAdmin(slug);
  if (!gate.ok) return gate;

  if (!userId || typeof userId !== "string") return teamFailure("invalid");

  const result = await removeMemberRows(gate.team, userId);
  if (!result.ok) return result;

  await sendRemovedFromTeamMail(result.removed, gate.team);
  return { ok: true };
}

/**
 * Hand management to another member: both roles and `manager_user_id` move in
 * one transaction (see `handOverManagementRows`). The new manager is told; the
 * outgoing one pressed the button.
 */
export async function handOverManagement(
  slug: string,
  userId: string,
): Promise<TeamActionResult> {
  const gate = await requireTeamManagerOrAdmin(slug);
  if (!gate.ok) return gate;

  if (!userId || typeof userId !== "string") return teamFailure("invalid");

  const result = await handOverManagementRows(gate.team, userId);
  if (!result.ok) return result;

  await sendManagementHandedOverMail(result.newManager, gate.team);
  return { ok: true };
}

/**
 * Dissolve the team. A hard delete; the database cascades memberships,
 * invitations and join requests, and the slug and code stop resolving at once.
 *
 * The team row is captured before the delete so the emails can still name it —
 * they are the only record the members will have left.
 */
export async function dissolveTeam(slug: string): Promise<TeamActionResult> {
  const gate = await requireTeamManagerOrAdmin(slug);
  if (!gate.ok) return gate;

  const team = gate.team;
  const result = await dissolveTeamRows(team, gate.userId);
  if (!result.ok) return result;

  for (const recipient of result.recipients) {
    await sendTeamDissolvedMail(recipient, team);
  }
  return { ok: true };
}
