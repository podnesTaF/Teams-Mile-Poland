import { TEAM_LIMITS, categoryAdmits, type TeamCategory, type TeamRole, type TeamSex } from "./config";

/**
 * The one implementation of "may this runner join this team" (PRD #57,
 * "Eligibility has one implementation").
 *
 * Pure: no database, no session, no clock. Every path that would add a member —
 * the create path (a manager must be eligible for their own team), the
 * invitation accept, the join-request accept, and the pre-check when a request
 * is filed — calls this function, so the two doors cannot drift.
 *
 * What is deliberately *not* here: the user gate chain (session, verified
 * email, complete profile, age 18). That is `guards.ts`, because it is about
 * the actor rather than the fit between a runner and a roster, and because it
 * needs I/O.
 */

/** Just enough of a team row to judge a candidate. */
export type EligibilityTeam = {
  category: TeamCategory;
};

/** One roster seat. `sex` is nullable only because `users.sex` is. */
export type RosterSeat = {
  userId: string;
  sex: TeamSex | null;
  role?: TeamRole;
};

/** The runner being judged, with the categories they already hold. */
export type EligibilityCandidate = {
  userId: string;
  sex: TeamSex | null;
  /** Categories of the teams this runner is already a member of. */
  categories: readonly TeamCategory[];
};

/** The five ways a roster can refuse a runner. A subset of `TeamActionReason`. */
export type EligibilityReason =
  | "wrong_category"
  | "roster_full"
  | "sex_balance"
  | "already_member"
  | "already_in_category";

export type EligibilityResult = { ok: true } | { ok: false; reason: EligibilityReason };

/**
 * Order matters, and it is the order a human would explain the refusal in:
 * you are already on this roster → your sex is wrong for this category → you
 * already hold a team in this category → the roster is full → the mixed balance
 * has no room for your sex. Checking `already_member` first keeps a re-accept
 * from being reported as "roster full".
 */
export function checkEligibility(
  team: EligibilityTeam,
  roster: readonly RosterSeat[],
  candidate: EligibilityCandidate,
): EligibilityResult {
  if (roster.some((seat) => seat.userId === candidate.userId)) {
    return { ok: false, reason: "already_member" };
  }

  // A null sex means an incomplete profile; the gate chain refuses that with
  // `profile` before we get here, so reaching this arm is a crafted request.
  if (!categoryAdmits(team.category, candidate.sex)) {
    return { ok: false, reason: "wrong_category" };
  }

  if (candidate.categories.includes(team.category)) {
    return { ok: false, reason: "already_in_category" };
  }

  const limits = TEAM_LIMITS[team.category];
  if (roster.length >= limits.max) {
    return { ok: false, reason: "roster_full" };
  }

  if (limits.minPerSex !== undefined) {
    // Room must remain for `minPerSex` of the *other* sex, so either sex is
    // capped at `max - minPerSex` (8 of 12 with a floor of 4).
    const perSexCap = limits.max - limits.minPerSex;
    const sameSex = roster.filter((seat) => seat.sex === candidate.sex).length;
    if (sameSex >= perSexCap) {
      return { ok: false, reason: "sex_balance" };
    }
  }

  return { ok: true };
}

/**
 * How far a roster is from **Complete**. Read from {@link TEAM_LIMITS} at
 * render time and never stored — a team drops back to incomplete the moment
 * someone leaves.
 */
export type TeamCompleteness = {
  category: TeamCategory;
  count: number;
  min: number;
  max: number;
  /** Members still needed to reach `min`; 0 once complete. */
  missing: number;
  complete: boolean;
  /** At the cap — no invitation or accept can add anyone. */
  full: boolean;
  men: number;
  women: number;
  /** `null` for men's and women's teams. */
  minPerSex: number | null;
  /** Men still needed to satisfy `minPerSex`; 0 when not mixed or already met. */
  menMissing: number;
  womenMissing: number;
};

export function computeCompleteness(
  category: TeamCategory,
  roster: readonly RosterSeat[],
): TeamCompleteness {
  const limits = TEAM_LIMITS[category];
  const count = roster.length;
  const men = roster.filter((seat) => seat.sex === "M").length;
  const women = roster.filter((seat) => seat.sex === "F").length;
  const minPerSex = limits.minPerSex ?? null;
  const menMissing = minPerSex === null ? 0 : Math.max(0, minPerSex - men);
  const womenMissing = minPerSex === null ? 0 : Math.max(0, minPerSex - women);

  // Complete is the lower bound *and*, on a mixed team, the four-of-each floor:
  // 8 members who are all men is not a complete mixed team.
  const missing = Math.max(limits.min - count, menMissing + womenMissing, 0);

  return {
    category,
    count,
    min: limits.min,
    max: limits.max,
    missing,
    complete: missing === 0,
    full: count >= limits.max,
    men,
    women,
    minPerSex,
    menMissing,
    womenMissing,
  };
}
