"use server";

import { eq, sql } from "drizzle-orm";
import { z } from "zod";

import { users } from "@/db/schema/auth";
import { userTeamInvitations } from "@/db/schema/user-teams";
import { getDb } from "@/lib/db";

import { TEAM_LIMITS, teamFailure, type TeamActionResult } from "../config";
import { getTeamRoster } from "../data";
import { requireTeamActor, requireTeamManagerOrAdmin } from "../guards";
import {
  acceptInvitationForUser,
  declineInvitation,
  getInvitationById,
  getInvitationByToken,
  getPendingInvitationForEmail,
  invitationExpiry,
  isInvitationExpired,
  listOpenInvitations,
  markInvitationExpired,
  newInvitationToken,
} from "../invitations";
import { asTeamMailLocale, sendInvitationEmail } from "../mail-invitations";

/**
 * The invitation door (#60): invite by email, resend, revoke, respond.
 *
 * Every export returns the frozen `{ ok: true, … } | { ok: false, reason,
 * message }` shape and never throws for an expected refusal. The mechanics
 * (token hashing, the locking accept transaction, the reads) live in
 * `../invitations.ts`, which is *not* a `"use server"` module — so the helper
 * #61 reuses can take arguments a client could never send.
 */

// `z.email()` (zod 4's top-level form, as used by the contact schema) rather
// than the deprecated `z.string().email()`. Folded to lower case here so the
// partial unique index on `lower(email)` and every comparison below agree.
const inviteSchema = z.object({
  email: z
    .email()
    .max(200)
    .transform((value) => value.trim().toLowerCase()),
});

export type InviteByEmailInput = z.infer<typeof inviteSchema>;

/** A display name for the "who invited you" line of the mail. */
function displayName(user: {
  name?: string | null;
  email: string;
  firstName?: unknown;
  lastName?: unknown;
}): string {
  const first = typeof user.firstName === "string" ? user.firstName : "";
  const last = typeof user.lastName === "string" ? user.lastName : "";
  return [first, last].filter(Boolean).join(" ").trim() || user.name?.trim() || user.email;
}

/**
 * Invite one address to the team.
 *
 * Refuses before writing anything when the address already sits on the roster
 * (`already_member`) or when the open invitations already claim every empty
 * seat (`roster_full`) — the cap doubles as the invitation limit, so a full
 * roster cannot accumulate a waiting list (PRD #57, user stories 21–22).
 *
 * Inviting an address that already holds a pending invitation **reissues the
 * token and the expiry on that same row** and mails it again: one pending
 * invitation per team per address is a partial unique index, and a manager
 * pressing the button twice must not create a second one.
 *
 * `on_behalf` is set when the caller got in through the admin `edit`
 * capability, which is what flips the mail to "the organiser invited you".
 */
export async function inviteByEmail(
  slug: string,
  input: InviteByEmailInput,
): Promise<TeamActionResult<{ invitationId: string; email: string }>> {
  const gate = await requireTeamManagerOrAdmin(slug);
  if (!gate.ok) return gate;

  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return teamFailure("invalid");
  const email = parsed.data.email;

  const team = gate.team;
  const roster = await getTeamRoster(team.id);
  if (roster.some((member) => member.email.toLowerCase() === email)) {
    return teamFailure("already_member");
  }

  const open = await listOpenInvitations(team.id);
  const existing = open.find((row) => row.email.toLowerCase() === email);
  const emptySeats = TEAM_LIMITS[team.category].max - roster.length;
  // A reissue does not claim a new seat, so it is excluded from the count.
  const claimed = open.filter((row) => row.email.toLowerCase() !== email).length;
  if (emptySeats <= 0 || claimed >= emptySeats) return teamFailure("roster_full");

  const token = newInvitationToken();
  const expiresAt = invitationExpiry();
  const db = getDb();

  let invitationId: string;
  if (existing) {
    await db
      .update(userTeamInvitations)
      .set({
        tokenHash: token.hash,
        expiresAt,
        invitedByUserId: gate.userId,
        onBehalf: gate.actingAsAdmin,
        email,
      })
      .where(eq(userTeamInvitations.id, existing.id));
    invitationId = existing.id;
  } else {
    try {
      const [row] = await db
        .insert(userTeamInvitations)
        .values({
          teamId: team.id,
          email,
          tokenHash: token.hash,
          invitedByUserId: gate.userId,
          onBehalf: gate.actingAsAdmin,
          status: "pending",
          expiresAt,
        })
        .returning({ id: userTeamInvitations.id });
      invitationId = row.id;
    } catch (error) {
      // Lost the race against another press of the same button: the row now
      // exists, so this press becomes the reissue it was always meant to be.
      if ((error as { code?: string })?.code !== "23505") throw error;
      const raced = await getPendingInvitationForEmail(team.id, email);
      if (!raced) throw error;
      await db
        .update(userTeamInvitations)
        .set({
          tokenHash: token.hash,
          expiresAt,
          invitedByUserId: gate.userId,
          onBehalf: gate.actingAsAdmin,
        })
        .where(eq(userTeamInvitations.id, raced.id));
      invitationId = raced.id;
    }
  }

  await mailInvitation({
    email,
    team,
    inviterName: displayName(gate.user),
    inviterLocale: (gate.user as { locale?: string | null }).locale ?? null,
    onBehalf: gate.actingAsAdmin,
    rawToken: token.raw,
    expiresAt,
  });

  return { ok: true, invitationId, email };
}

/**
 * Re-mail a pending invitation with a **new** token and a fresh 30-day clock.
 * The old link stops working the moment this returns — a resend is a reissue,
 * not a second copy of the same link.
 */
export async function resendInvitation(
  invitationId: string,
): Promise<TeamActionResult<{ invitationId: string }>> {
  const found = await getInvitationById(invitationId);
  if (!found) return teamFailure("notfound");

  const gate = await requireTeamManagerOrAdmin(found.team.slug);
  if (!gate.ok) return gate;

  if (found.invitation.status !== "pending") return teamFailure("used");

  const token = newInvitationToken();
  const expiresAt = invitationExpiry();
  const db = getDb();
  await db
    .update(userTeamInvitations)
    .set({ tokenHash: token.hash, expiresAt, onBehalf: gate.actingAsAdmin })
    .where(eq(userTeamInvitations.id, found.invitation.id));

  await mailInvitation({
    email: found.invitation.email,
    team: found.team,
    inviterName: displayName(gate.user),
    inviterLocale: (gate.user as { locale?: string | null }).locale ?? null,
    onBehalf: gate.actingAsAdmin,
    rawToken: token.raw,
    expiresAt,
  });

  return { ok: true, invitationId: found.invitation.id };
}

/** Withdraw a pending invitation. The link stops resolving to an accept screen. */
export async function revokeInvitation(
  invitationId: string,
): Promise<TeamActionResult<{ invitationId: string }>> {
  const found = await getInvitationById(invitationId);
  if (!found) return teamFailure("notfound");

  const gate = await requireTeamManagerOrAdmin(found.team.slug);
  if (!gate.ok) return gate;

  if (found.invitation.status !== "pending") return teamFailure("used");

  const db = getDb();
  await db
    .update(userTeamInvitations)
    .set({ status: "revoked", decidedAt: new Date() })
    .where(eq(userTeamInvitations.id, found.invitation.id));

  return { ok: true, invitationId: found.invitation.id };
}

/**
 * Accept or decline.
 *
 * `token` is the **raw token from the link**. It is also accepted as an
 * invitation *row id*, which is the only identifier the profile list can hold
 * (the raw token exists nowhere but the mailed link) — and because a row id is
 * not a bearer token, that path additionally requires the signed-in account's
 * address to be the invited one. The link path deliberately does not: an
 * invitation is accepted by *whichever account opens it*, so an alias or a
 * second address cannot lock a runner out (PRD #57).
 */
export async function respondToInvitation(
  token: string,
  decision: "accept" | "decline",
): Promise<TeamActionResult<{ teamSlug: string; decision: "accept" | "decline" }>> {
  const actor = await requireTeamActor();
  if (!actor.ok) return actor;
  if (decision !== "accept" && decision !== "decline") return teamFailure("invalid");

  const raw = token.trim();
  if (!raw) return teamFailure("notfound");

  let found = await getInvitationByToken(raw);
  if (!found && /^[0-9a-f-]{36}$/i.test(raw)) {
    const byId = await getInvitationById(raw);
    if (byId) {
      if (byId.invitation.email.toLowerCase() !== actor.user.email.toLowerCase()) {
        return teamFailure("forbidden");
      }
      found = byId;
    }
  }
  if (!found) return teamFailure("notfound");

  const { invitation, team } = found;
  if (invitation.status !== "pending") return teamFailure("used");
  if (isInvitationExpired(invitation)) {
    await markInvitationExpired(invitation.id);
    return teamFailure("expired");
  }

  if (decision === "decline") {
    await declineInvitation(invitation.id);
    return { ok: true, teamSlug: team.slug, decision };
  }

  const accepted = await acceptInvitationForUser(invitation.id, actor.userId);
  if (!accepted.ok) return accepted;
  return { ok: true, teamSlug: accepted.teamSlug, decision };
}

/**
 * Mail the invitation in the **recipient's** language: their account locale
 * when the address already has one, otherwise the inviter's — a Polish manager
 * inviting a Ukrainian runner should not mail them Polish.
 */
async function mailInvitation({
  email,
  team,
  inviterName,
  inviterLocale,
  onBehalf,
  rawToken,
  expiresAt,
}: {
  email: string;
  team: Parameters<typeof sendInvitationEmail>[0]["team"];
  inviterName: string;
  inviterLocale: string | null;
  onBehalf: boolean;
  rawToken: string;
  expiresAt: Date;
}): Promise<void> {
  const db = getDb();
  const [account] = await db
    .select({ locale: users.locale })
    .from(users)
    .where(sql`lower(${users.email}) = lower(${email})`)
    .limit(1);

  await sendInvitationEmail({
    to: email,
    locale: asTeamMailLocale(account?.locale ?? inviterLocale),
    team,
    inviterName,
    onBehalf,
    rawToken,
    expiresAt,
  });
}
