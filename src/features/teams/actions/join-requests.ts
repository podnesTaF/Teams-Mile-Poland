"use server";

import { eq } from "drizzle-orm";

import { users } from "@/db/schema/auth";
import type { UserTeamRow } from "@/db/schema/user-teams";
import { getDb } from "@/lib/db";

import { teamFailure, type TeamActionResult } from "../config";
import { getEligibilityCandidate, getRosterSeats, getTeamByCode } from "../data";
import { checkEligibility, computeCompleteness, type RosterSeat } from "../eligibility";
import { requireTeamActor, requireTeamManagerOrAdmin } from "../guards";
import {
  acceptInvitationForUser,
  getPendingInvitationForEmail,
  isInvitationExpired,
  markInvitationExpired,
} from "../invitations";
import {
  createJoinRequest,
  decideJoinRequestForManager,
  getJoinRequestById,
  getPendingJoinRequest,
  withdrawJoinRequestRow,
} from "../join-requests";
import { asTeamMailLocale } from "../mail-invitations";
import { sendJoinRequestReceivedEmail } from "../mail-requests";

/**
 * The runner's door (#61): knock, take the knock back, and — for the manager —
 * answer it.
 *
 * Every export returns the frozen `{ ok: true, … } | { ok: false, reason,
 * message }` shape and never throws for an expected refusal. The row work and
 * the locking accept transaction live in `../join-requests.ts`, which is *not* a
 * `"use server"` module, so page code can read the queue without any of it being
 * callable over the wire.
 */

/**
 * Ask to join the team this **Team code** identifies.
 *
 * Three things happen in a deliberate order:
 *
 *  1. **An outstanding invitation wins.** A runner who was already invited and
 *     then typed the code is admitted *through the invitation* — the same
 *     `acceptInvitationForUser` the link opens — rather than filing a request
 *     the manager would have to answer for someone they already asked. No
 *     request row is created. An invitation past its expiry is flipped to
 *     `expired` and the runner falls through to the request path, because being
 *     invited too long ago must not become a reason you cannot knock.
 *  2. **Eligibility is checked before anything is written.** An ineligible
 *     runner is told which of the five reasons applies and the database is
 *     untouched — a queue full of requests that can only ever be declined is
 *     worse than an immediate answer (PRD #57, user story 30).
 *  3. **The row, then the mail.** The partial unique index enforces one open
 *     request per runner per team; a declined runner may knock again and gets a
 *     new row.
 */
export async function requestToJoin(
  code: string,
): Promise<TeamActionResult<{ teamSlug: string; joined: boolean }>> {
  const actor = await requireTeamActor();
  if (!actor.ok) return actor;

  const team = await getTeamByCode(code);
  if (!team) return teamFailure("notfound");

  const invitation = await getPendingInvitationForEmail(team.id, actor.user.email);
  if (invitation) {
    if (isInvitationExpired(invitation)) {
      await markInvitationExpired(invitation.id);
    } else {
      const accepted = await acceptInvitationForUser(invitation.id, actor.userId);
      if (!accepted.ok) return accepted;
      return { ok: true, teamSlug: accepted.teamSlug, joined: true };
    }
  }

  const seats = (await getRosterSeats([team.id])).get(team.id) ?? [];
  const candidate = await getEligibilityCandidate(actor.userId);
  if (!candidate) return teamFailure("auth");

  const eligibility = checkEligibility({ category: team.category }, seats, candidate);
  if (!eligibility.ok) return teamFailure(eligibility.reason);

  // Read before writing so the second press gets `used` rather than a raced
  // insert; `createJoinRequest` catches the index violation regardless.
  if (await getPendingJoinRequest(team.id, actor.userId)) return teamFailure("used");

  const created = await createJoinRequest(team.id, actor.userId);
  if (!created.ok) return created;

  await mailManager(team, actor.userId, seats);

  return { ok: true, teamSlug: team.slug, joined: false };
}

/**
 * Take a pending request back. **The requester's own action** — a manager who
 * wants it gone declines it instead, which is a decision the runner is told
 * about.
 */
export async function withdrawJoinRequest(
  requestId: string,
): Promise<TeamActionResult<{ teamSlug: string }>> {
  const actor = await requireTeamActor();
  if (!actor.ok) return actor;

  const found = await getJoinRequestById(requestId);
  if (!found) return teamFailure("notfound");
  if (found.request.userId !== actor.userId) return teamFailure("forbidden");
  if (found.request.status !== "pending") return teamFailure("used");

  await withdrawJoinRequestRow(found.request.id);
  return { ok: true, teamSlug: found.team.slug };
}

/**
 * Accept or decline. Manager-or-admin only; the gate is resolved from the
 * request's own team, so the caller never gets to name the team it is acting on.
 *
 * Accept re-runs eligibility under a `select … for update` on the team row (see
 * `decideJoinRequestForManager`) — the runner may have joined another team in
 * this category, or the last seat may have gone, since they knocked.
 */
export async function decideJoinRequest(
  requestId: string,
  decision: "accept" | "decline",
): Promise<TeamActionResult<{ teamSlug: string; decision: "accept" | "decline" }>> {
  if (decision !== "accept" && decision !== "decline") return teamFailure("invalid");

  const found = await getJoinRequestById(requestId);
  if (!found) return teamFailure("notfound");

  const gate = await requireTeamManagerOrAdmin(found.team.slug);
  if (!gate.ok) return gate;

  const decided = await decideJoinRequestForManager(found.request.id, decision, gate.userId);
  if (!decided.ok) return decided;

  return { ok: true, teamSlug: decided.teamSlug, decision: decided.decision };
}

/**
 * Tell the manager somebody knocked, in the **manager's** language. Sent after
 * the row exists and its failure never changes the result: the request is
 * filed either way and the queue on the team page is the source of truth.
 */
async function mailManager(
  team: UserTeamRow,
  requesterUserId: string,
  seats: RosterSeat[],
): Promise<void> {
  const db = getDb();
  const [manager] = await db
    .select({ email: users.email, locale: users.locale })
    .from(users)
    .where(eq(users.id, team.managerUserId))
    .limit(1);
  if (!manager) return;

  const [requester] = await db
    .select({
      firstName: users.firstName,
      lastName: users.lastName,
      name: users.name,
      email: users.email,
    })
    .from(users)
    .where(eq(users.id, requesterUserId))
    .limit(1);
  if (!requester) return;

  // The roster as it stands — the request has not changed it, and will not
  // unless the manager accepts.
  const completeness = computeCompleteness(team.category, seats);

  await sendJoinRequestReceivedEmail({
    to: manager.email,
    locale: asTeamMailLocale(manager.locale),
    team,
    runnerName:
      [requester.firstName, requester.lastName].filter(Boolean).join(" ").trim() ||
      requester.name ||
      requester.email,
    count: completeness.count,
    min: completeness.min,
    complete: completeness.complete,
  });
}
