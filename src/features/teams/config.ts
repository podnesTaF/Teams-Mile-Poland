/**
 * Team formation config — the one place the category set, the roster limits and
 * the code alphabet are declared (PRD #57, Contracts → Registry / config).
 *
 * Pure data and types only. This module is imported by the Drizzle schema
 * (`src/db/schema/user-teams.ts`, type-only so drizzle-kit never loads it), by
 * server actions, and by client islands — keep it free of `server-only`, of
 * database imports and of anything Node-specific.
 *
 * Distinct from the frozen legacy `src/features/team/*` (ADR 0008): these are
 * standing, account-backed teams.
 */

/** Men, women or mixed — fixed when the team is created, never changed. */
export type TeamCategory = "men" | "women" | "mixed";

/** The category set as a value, for `<select>` options and zod enums. */
export const TEAM_CATEGORIES = ["men", "women", "mixed"] as const;

/** Platform role on a roster. The rules' *Captain* is a race-side role, not this. */
export type TeamRole = "manager" | "member";

/** Profile sex, as `users.sex` stores it. Eligibility is read from it. */
export type TeamSex = "M" | "F";

export type TeamInvitationStatus = "pending" | "accepted" | "declined" | "revoked" | "expired";

export type TeamJoinRequestStatus = "pending" | "accepted" | "declined" | "withdrawn";

/**
 * Roster limits per category. **Total over {@link TeamCategory} on purpose**:
 * adding a category is a compile error here and at every `Record<TeamCategory,…>`
 * until its limits are declared.
 *
 * `min` is **Complete** (the lower bound, read at admission, never stored);
 * `max` is the roster cap at which invitations and accepts are refused.
 * `minPerSex` applies to mixed only — at least four of each sex, which in
 * practice caps either sex at `max - minPerSex` = 8.
 */
export const TEAM_LIMITS: Record<
  TeamCategory,
  { min: number; max: number; minPerSex?: number }
> = {
  men: { min: 7, max: 11 },
  women: { min: 7, max: 11 },
  mixed: { min: 8, max: 12, minPerSex: 4 },
};

/** How long an invitation link stays openable. Resend resets the clock. */
export const INVITATION_TTL_DAYS = 30;

export const TEAM_CODE_LENGTH = 6;

/** 32 symbols, no `0/O` and no `1/I` — the code is read aloud and typed by hand. */
export const TEAM_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

/**
 * Every way a team action can refuse. Returned as a *key*, never as a sentence:
 * the copy lives in `teams.reasons.<reason>` in all three catalogs, so a refusal
 * is translated at the call site rather than in the action.
 */
export type TeamActionReason =
  | "auth"
  | "verify"
  | "profile"
  | "age"
  | "notfound"
  | "forbidden"
  | "name_taken"
  | "roster_full"
  | "sex_balance"
  | "wrong_category"
  | "already_member"
  | "already_in_category"
  | "expired"
  | "used"
  | "manager_must_hand_over"
  | "invalid"
  // Team entry and race day (PRD #64): entry (#67), member confirmation (#68),
  // team check-in (#69). Copy for each lives in `teams.reasons.<reason>` ×3.
  | "incomplete_team"
  | "not_open"
  | "already_entered"
  | "member_underage"
  | "already_checked_in"
  | "consent_pending"
  | "invalid_composition"
  | "bib_pool"
  | "heat_started"
  | "not_reserve"
  | "remind_limit"
  | "already_confirmed"
  | "cancelled"
  // Mixed nights (ADR 0009): a member already holds an individual registration
  // for that event, and one person has one entry path per night.
  | "registered_individually"
  // Team creation is paid in ACER (planning/team-creation-payment): the
  // creator's wallet holds less than `TEAM_CREATION_PRICE_ACER`.
  | "insufficient_balance";

/** The frozen failure half of every team action's return value. */
export type TeamActionFailure = {
  ok: false;
  reason: TeamActionReason;
  /** The message-key path (`teams.reasons.<reason>`), not a user-facing string. */
  message: string;
};

/**
 * The frozen return shape of every team server action:
 * `{ ok: true, ...payload } | { ok: false, reason, message }`.
 */
export type TeamActionResult<T = object> = ({ ok: true } & T) | TeamActionFailure;

/**
 * Build a refusal. `message` carries the message-key path so a caller that has
 * no translator still has something meaningful to log; UI should prefer
 * `t(\`reasons.\${result.reason}\`)` off the `teams` namespace.
 */
export function teamFailure(reason: TeamActionReason): TeamActionFailure {
  return { ok: false, reason, message: `teams.reasons.${reason}` };
}

/** Narrowing helper for values arriving from forms, URLs or legacy rows. */
export function isTeamCategory(value: unknown): value is TeamCategory {
  return typeof value === "string" && (TEAM_CATEGORIES as readonly string[]).includes(value);
}

/** Which sexes a category admits. Mixed takes both. */
export function categoryAdmits(category: TeamCategory, sex: TeamSex | null | undefined): boolean {
  if (sex !== "M" && sex !== "F") return false;
  if (category === "mixed") return true;
  return category === "men" ? sex === "M" : sex === "F";
}
