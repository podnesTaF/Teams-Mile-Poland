import type { UserTeamRow } from "@/db/schema/user-teams";
import { coerceToDate, meetsMinParticipantAge } from "@/lib/age";
import {
  getUser,
  isProfileComplete,
  userCan,
  type SessionUser,
} from "@/lib/auth/user-session";

import { teamFailure, type TeamActionFailure, type TeamSex } from "./config";
import { getTeamBySlug } from "./data";

/**
 * The gate chain every team action runs before it does anything (PRD #57,
 * "Guard order for every user action: session → emailVerified →
 * isProfileComplete → age ≥ 18 today → action-specific rule").
 *
 * These functions **return a refusal, they never redirect**. `requireAdmin` in
 * `features/admin/action-helpers.ts` redirects and `notFound()`s, which is right
 * for a *page* and wrong inside a server action: a thrown redirect from an
 * action gives the client island nothing to render. Pages do their own
 * redirecting (see `/teams/new`), actions get a `{ ok: false, reason }`.
 *
 * The age check is against **today**, not an event date: formation has no
 * event, and the team rules admit only adults (§2.1). Deliberately stricter
 * than the per-event check, so a team can never recruit someone who could not
 * race for it.
 */

/** The signed-in runner, already past the whole chain. */
export type TeamActor = {
  user: SessionUser;
  userId: string;
  sex: TeamSex | null;
};

export type TeamActorResult = ({ ok: true } & TeamActor) | TeamActionFailure;

export async function requireTeamActor(): Promise<TeamActorResult> {
  const user = await getUser();
  if (!user) return teamFailure("auth");
  if (!user.emailVerified) return teamFailure("verify");
  if (!isProfileComplete(user)) return teamFailure("profile");

  const dob = coerceToDate((user as { dateOfBirth?: unknown }).dateOfBirth);
  if (!dob || !meetsMinParticipantAge(dob)) return teamFailure("age");

  return {
    ok: true,
    user,
    userId: user.id,
    sex: ((user as { sex?: string | null }).sex ?? null) as TeamSex | null,
  };
}

/** The manager (or an admin acting for them) plus the team they may touch. */
export type TeamManagerContext = {
  user: SessionUser;
  userId: string;
  team: UserTeamRow;
  /** True when the actor got in through the admin `edit` capability. */
  actingAsAdmin: boolean;
};

export type TeamManagerResult = ({ ok: true } & TeamManagerContext) | TeamActionFailure;

/**
 * Manager-or-admin gate for `updateTeam`, `rotateTeamCode` and every
 * manager-only action in the later slices (invite, decide, remove, hand over,
 * dissolve).
 *
 * The admin branch is checked **before** the runner gate chain on purpose: an
 * organiser fixing an abandoned team is not required to have a complete runner
 * profile or to be 18 on the platform's terms. `edit` is the capability
 * (`admin` only — `admin_checkin` and `admin_viewer` fall through to the
 * manager test and are refused with `forbidden`), matching "admin variants run
 * through `requireAdmin(locale, "edit")`" without importing the redirecting
 * helper.
 */
export async function requireTeamManagerOrAdmin(slug: string): Promise<TeamManagerResult> {
  const user = await getUser();
  if (!user) return teamFailure("auth");

  const team = await getTeamBySlug(slug);
  if (!team) return teamFailure("notfound");

  if (userCan(user, "edit")) {
    return { ok: true, user, userId: user.id, team, actingAsAdmin: true };
  }

  const actor = await requireTeamActor();
  if (!actor.ok) return actor;
  if (team.managerUserId !== actor.userId) return teamFailure("forbidden");

  return { ok: true, user: actor.user, userId: actor.userId, team, actingAsAdmin: false };
}

/**
 * Page-side twin of the chain, for rendering the signed-out / unverified /
 * incomplete-profile / under-18 states without a redirect. Returns the reason
 * the page should render, or `null` when the runner is through.
 */
export function teamGateState(
  user: SessionUser | null,
): "auth" | "verify" | "profile" | "age" | null {
  if (!user) return "auth";
  if (!user.emailVerified) return "verify";
  if (!isProfileComplete(user)) return "profile";
  const dob = coerceToDate((user as { dateOfBirth?: unknown }).dateOfBirth);
  if (!dob || !meetsMinParticipantAge(dob)) return "age";
  return null;
}
