import { categoryAdmits, type TeamCategory, type TeamRole, type TeamSex } from "./config";
import { COMPOSITION, composedSeatCount } from "./rating-rules";

/**
 * The one implementation of "may this runner join this team" (PRD #57,
 * "Eligibility has one implementation").
 *
 * Pure: no database, no session, no clock. Every path that would add a member —
 * the create path (a manager must be eligible for their own team), the
 * invitation accept, the join-request accept, and the pre-check when a request
 * is filed — calls this function, so the two doors cannot drift.
 *
 * A roster has **no size limit** (ADR 0011): a team may carry as many reserves
 * as it likes, so nothing here counts seats. The only size the platform knows
 * is the race composition on the night, which {@link entryShortfall} reads at
 * event entry.
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

/** The three ways a roster can refuse a runner. A subset of `TeamActionReason`. */
export type EligibilityReason = "wrong_category" | "already_member" | "already_in_category";

export type EligibilityResult = { ok: true } | { ok: false; reason: EligibilityReason };

/**
 * Order matters, and it is the order a human would explain the refusal in:
 * you are already on this roster → your sex is wrong for this category → you
 * already hold a team in this category.
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

  return { ok: true };
}

/**
 * The roster in numbers — how many, and the men/women split. Computed at render
 * time and never stored. There is no target and no cap to measure it against:
 * the count is shown as a plain count, never as "x of N".
 */
export type RosterSummary = {
  category: TeamCategory;
  count: number;
  men: number;
  women: number;
};

export function summarizeRoster(
  category: TeamCategory,
  roster: readonly RosterSeat[],
): RosterSummary {
  return {
    category,
    count: roster.length,
    men: roster.filter((seat) => seat.sex === "M").length,
    women: roster.filter((seat) => seat.sex === "F").length,
  };
}

/**
 * How many more members a roster needs before it could field a race
 * composition — the one place a team's size is judged, and it is judged at
 * **event entry**, not at formation.
 *
 * Read from `COMPOSITION` (`rating-rules.ts`): the composed seat count, and on a
 * mixed team the 4+4 rule (four male RACERS, two female pairs), because eight
 * men is not a mixed team that can start. `0` means the team may enter.
 */
export function entryShortfall(category: TeamCategory, roster: readonly RosterSeat[]): number {
  const rules = COMPOSITION[category];
  const bySeats = composedSeatCount(category) - roster.length;

  let bySex = 0;
  if (rules.racerSex) {
    const racers = roster.filter((seat) => seat.sex === rules.racerSex).length;
    bySex += Math.max(0, rules.racers - racers);
  }
  if (rules.pairSex) {
    const pairRunners = roster.filter((seat) => seat.sex === rules.pairSex).length;
    bySex += Math.max(0, rules.pairs * 2 - pairRunners);
  }

  return Math.max(bySeats, bySex, 0);
}
