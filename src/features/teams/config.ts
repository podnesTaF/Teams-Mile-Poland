/**
 * Team formation config — the one place the category set and the code alphabet
 * are declared (PRD #57, Contracts → Registry / config).
 *
 * There is deliberately **no roster limit** here: a roster is unbounded (ADR
 * 0011). The only team size the platform knows is the race composition on the
 * night — `COMPOSITION` in `rating-rules.ts` — and it is read at event entry
 * and at check-in, never at formation.
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
  | "insufficient_balance"
  // Team treasury (ADR 0012): the treasury holds less than the payout; the
  // payee is no longer on the roster; the amount is not whole ACER within
  // bounds; the form was re-submitted after its fields changed; payouts are
  // switched off until the Terms are revised.
  | "treasury_insufficient"
  | "not_a_member"
  | "invalid_amount"
  | "stale_form"
  | "payouts_disabled"
  // Card-paid team nights (ADR 0015): Stripe could not start a checkout; or a
  // payment for this team and night has settled and the entry is still being
  // written.
  | "payment_unavailable"
  | "payment_pending"
  // Organiser-placed teams (ADR 0016): a door PRD #64 built that is switched
  // off (`isTeamFormationEnabled`), or one self-service formation offered that
  // is closed (join requests, the team code); an invitation into a team that is
  // not one of `PLACEMENT_TEAM_SLUGS`; founding a team, which is impossible.
  | "paused"
  | "not_placement_team"
  | "creation_closed";

/**
 * The four standing **placement teams** — Ace Battle Mile RED Warsaw and BLACK
 * Warsaw, men's and women's (ADR 0016). They are entered on every night with a
 * team path by definition, and they are the only teams that take new members:
 * an invitation into any other team is refused `not_placement_team`.
 *
 * Slugs, not ids: the slug is what a page, an action and an admin read, and it
 * never changes on rename (`updateTeam` leaves it alone).
 */
export const PLACEMENT_TEAM_SLUGS = [
  "ab-praga-poludnie",
  "ab-wilanow",
  "ab-praga-poludnie-2",
  "ab-wilanow-2",
] as const;

export type PlacementTeamSlug = (typeof PLACEMENT_TEAM_SLUGS)[number];

export function isPlacementTeamSlug(slug: string): slug is PlacementTeamSlug {
  return (PLACEMENT_TEAM_SLUGS as readonly string[]).includes(slug);
}

/**
 * The colour a placement team runs under — what a ticket, a profile card and
 * the confirmation email print ("Team race — RED"). A proper name, the same in
 * every language, so it is data here rather than a catalog key. The men's and
 * women's team of one colour print the same word; the admin roster (#84)
 * appends the category when it needs to tell them apart.
 */
export const PLACEMENT_TEAM_COLOURS: Record<PlacementTeamSlug, "RED" | "BLACK"> = {
  "ab-praga-poludnie": "RED",
  "ab-wilanow": "BLACK",
  "ab-praga-poludnie-2": "RED",
  "ab-wilanow-2": "BLACK",
};

/** The short label for a team slug: its colour for a placement team, else `null`. */
export function placementTeamShortLabel(slug: string): "RED" | "BLACK" | null {
  return isPlacementTeamSlug(slug) ? PLACEMENT_TEAM_COLOURS[slug] : null;
}

/**
 * Which race a registration is for (ADR 0016, migration 0031): the **team**
 * race for a runner on a placement roster at the moment they register, the
 * **individual** mile for everyone else. Derived, never chosen — see
 * `raceFor` in `placement.ts`, the one place a registration's value comes from.
 */
export type RaceFormat = "individual" | "team";

/**
 * Whether the manager-driven team machinery of PRD #64 is on: entering a team
 * into a night and withdrawing it (`/teams/[slug]/entries/[eventSlug]`), and
 * the team treasury (`/teams/[slug]/treasury`, contributions and payouts).
 *
 * Off unless `TEAM_FORMATION_ENABLED=1` (ADR 0016): the placement teams are
 * entered by definition and their members' race follows membership, so none of
 * it has a job today — it is paused, not removed, because it is the natural
 * second step once a night has run on the derived race. Same shape as
 * `isTreasuryPayoutEnabled`; deliberately not `NEXT_PUBLIC_`, the server
 * decides. Read on the server only — in a client bundle it is always `false`.
 */
export function isTeamFormationEnabled(): boolean {
  return process.env.TEAM_FORMATION_ENABLED === "1";
}

/**
 * Self-service formation — founding a team, the team code, join requests — is
 * closed for good (ADR 0016). Not an env switch: the owner's rule is that only
 * the four placement teams exist as destinations. A named constant rather than
 * deleted bodies so the refusing actions read as the rule they enforce, and so
 * the rows already written (pending join requests, every team's code) keep the
 * readers the admin pages still use.
 */
export const SELF_SERVICE_FORMATION_CLOSED = true;

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
