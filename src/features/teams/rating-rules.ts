/**
 * Rating rules — the one versioned config the team format's race day runs under
 * (PRD #64, Contracts → Registry / config).
 *
 * Two race nights must never disagree on a constant. The stage options, the
 * composition counts and (from PRD #65 on) the penalties and level tables are
 * therefore declared **here**, once, behind a version string, and every team
 * entry stores the {@link RATING_RULES_VERSION} it ran under. A later constant
 * change then adds a new version rather than rewriting an old race — the same
 * discipline the legal manifest applies to document text (ADR 0006), for the
 * same reason: the number a result was computed from is evidence.
 *
 * **Pure data and one pure function.** No `server-only`, no database imports,
 * nothing Node-specific — exactly like `config.ts` next to it, and for the same
 * three consumers: the Drizzle schema (type-only, so drizzle-kit never loads
 * this module), the server actions, and the admin composition editor, which is a
 * client island and validates client-side against the very same function the
 * action re-runs server-side. One validator, two callers, no way to disagree
 * (PRD #64 user story 42).
 *
 * Terms are `CONTEXT.md` § Teams: a **Race composition** is the set of
 * **Race roles** fixed at **Team check-in**; a **Stage option** is where a pair's
 * ACE hands over to its JOKER; a member left out of the composition is a
 * **Reserve**.
 */

import { coerceToDate, meetsMinParticipantAge } from "@/lib/age";

import type { TeamCategory, TeamSex } from "./config";

/**
 * The version every entry records. Bump when any constant below changes —
 * never edit a constant in place, because entries already point at this string.
 *
 * Deliberately the same date the TEAM MILE legal corpus declares
 * (`2026-09-01`, "Data przyjęcia" in the Rules): these constants *are* the
 * rules' Appendix 4/5 numbers, so the two versions moving together is the
 * honest reading. They are still independent strings — a rating change that
 * needs no new document text bumps only this one.
 */
export const RATING_RULES_VERSION = "2026-09-01";

/**
 * Where a pair's ACE hands over to its JOKER: after roughly 1, 2 or 3 laps.
 *
 * Declared by the pair at check-in, never measured (PRD #64, Implementation
 * Decisions → "Stage options are declared, not measured"). The joker zone spans
 * 40–60 m before the line, so each option's nominal split is ±10 m and that
 * tolerance is accepted rather than modelled.
 */
export type StageOption = "1lap" | "2lap" | "3lap";

/**
 * Nominal metres per role for each stage option. `aceM + jokerM` is the mile
 * (1609 m) in all three, which is the invariant to preserve if these are ever
 * re-cut.
 */
export const STAGE_OPTIONS: Record<StageOption, { aceM: number; jokerM: number }> = {
  "1lap": { aceM: 360, jokerM: 1249 },
  "2lap": { aceM: 760, jokerM: 849 },
  "3lap": { aceM: 1160, jokerM: 449 },
};

/** The stage options as a value, for `<select>` options and zod enums. */
export const STAGE_OPTION_KEYS = ["1lap", "2lap", "3lap"] as const satisfies readonly StageOption[];

/**
 * What a composed member does on the night. A **RACER** runs the full mile; an
 * **ACE** runs the first stage of a pair and hands over to its **JOKER** in the
 * zone. The rules' *Captain* is not one of these — that is the manager, a
 * platform role (`config.ts`).
 */
export type RaceRole = "racer" | "ace" | "joker";

/** The race roles as a value, for `<select>` options and zod enums. */
export const RACE_ROLES = ["racer", "ace", "joker"] as const satisfies readonly RaceRole[];

/**
 * How many of each role a category's composition must name.
 *
 * **Total over {@link TeamCategory} on purpose** (`Record`, not a partial map):
 * adding a category is a compile error here rather than a runtime "no rules for
 * this team" that would let an unvalidated composition reach the start line.
 *
 * `racerSex` / `pairSex` are the rules' mixed 4+4: four male RACERS and two
 * female pairs, i.e. four women running in pairs. Men's and women's teams carry
 * neither, because their roster is single-sex by construction — category
 * eligibility is enforced when a member joins (`eligibility.ts`), so re-checking
 * it at check-in would be asking the same question twice.
 */
export const COMPOSITION: Record<
  TeamCategory,
  { racers: number; pairs: number; racerSex?: TeamSex; pairSex?: TeamSex }
> = {
  men: { racers: 3, pairs: 2 },
  women: { racers: 3, pairs: 2 },
  mixed: { racers: 4, pairs: 2, racerSex: "M", pairSex: "F" },
};

/** Narrowing helper for a stage option arriving from a form or a DB row. */
export function isStageOption(value: unknown): value is StageOption {
  return typeof value === "string" && (STAGE_OPTION_KEYS as readonly string[]).includes(value);
}

/** Narrowing helper for a race role arriving from a form or a DB row. */
export function isRaceRole(value: unknown): value is RaceRole {
  return typeof value === "string" && (RACE_ROLES as readonly string[]).includes(value);
}

/** How many members a category's composition names in total (RACERS + pairs×2). */
export function composedSeatCount(category: TeamCategory): number {
  const rules = COMPOSITION[category];
  return rules.racers + rules.pairs * 2;
}

/**
 * One entered member as the validator needs to see them: who they are, and the
 * three facts that decide whether they may be *composed* — sex (the mixed rule),
 * confirmed consent (`event_registrations.consent_pending = false`, PRD #64
 * decision 3) and date of birth (18 on the event date).
 *
 * Deliberately not a DB row type: the caller joins whatever it has (the entry
 * members joined to `users`, or a fixture literal) down to this shape, which is
 * what keeps this module free of the database.
 */
export type CompositionSeat = {
  userId: string;
  sex: TeamSex | null;
  dateOfBirth: Date | string | null;
  confirmed: boolean;
};

/**
 * One line of the composition the manager dictates at the desk.
 *
 * `pairNo` and `stageOption` belong to pair members only: a RACER carrying
 * either is a mistake worth naming, not a field to ignore, because it means the
 * desk's form and the manager's intent have come apart.
 */
export type CompositionRow = {
  userId: string;
  role: RaceRole;
  pairNo?: 1 | 2;
  stageOption?: StageOption;
};

/**
 * Why a composition was refused — one specific problem, never a bare "invalid".
 *
 * The desk is standing in front of the manager: "two ACEs in pair 1" is
 * actionable, "invalid composition" starts an argument. Each code carries the
 * minimum the surface needs to name the offender (PRD #64 user story 29).
 *
 * - `role_counts` — the wrong number of RACERS, ACEs or JOKERs for the category.
 * - `pair_shape` — a pair that is not exactly one ACE and one JOKER sharing a
 *   pair number and a stage option, or a RACER carrying pair fields. `pairNo`
 *   is `0` when the offending row names no pair at all.
 * - `mixed_sex` — the mixed 4+4 rule: a non-male RACER or a non-female pair
 *   member. A seat whose profile records no sex lands here too: the rule cannot
 *   be satisfied by an unknown, and the fix is the same (fix the profile or
 *   compose somebody else).
 * - `unconfirmed` — the member has not accepted the team document set yet.
 * - `underage` — not 18 on the **event date** (PRD #64 decision 7). A seat with
 *   no date of birth is reported here for the same reason as `mixed_sex`: an
 *   unverifiable age is not a verified one.
 * - `duplicate` — the same member named twice.
 * - `unknown_member` — a composed member who is not on this entry at all.
 */
export type CompositionProblem =
  | {
      code: "role_counts";
      expected: { racers: number; pairs: number };
      got: { racers: number; aces: number; jokers: number };
    }
  | { code: "pair_shape"; pairNo: number }
  | { code: "mixed_sex"; userId: string; role: RaceRole }
  | { code: "unconfirmed"; userId: string }
  | { code: "underage"; userId: string }
  | { code: "duplicate"; userId: string }
  | { code: "unknown_member"; userId: string };

/**
 * The verdict. The failure half carries the team action union's
 * `invalid_composition` reason verbatim, so a caller can return
 * `teamFailure("invalid_composition")` alongside `problem` without translating
 * anything — the copy lives in `teams.reasons.invalid_composition` ×3 and the
 * sub-reason is rendered from `problem` by the surface.
 */
export type CompositionVerdict =
  | { ok: true }
  | { ok: false; reason: "invalid_composition"; problem: CompositionProblem };

function fail(problem: CompositionProblem): CompositionVerdict {
  return { ok: false, reason: "invalid_composition", problem };
}

/**
 * Validate a race composition against the rules — the single validator both
 * `checkInTeam` and `swapComposed` run (PRD #64 user story 42), and the one the
 * admin composition editor mirrors client-side by calling it directly.
 *
 * Pure: no I/O, no clock, no database. The event date is a parameter precisely
 * so age is answered against the night being raced and never against
 * `new Date()` — the same rule the individual register flow follows.
 *
 * Checks run **structure first, people second**: duplicates, membership, role
 * counts and pair shape before sex, consent and age. A desk that mistyped the
 * roles should be told that, not handed a complaint about the person who
 * happened to land in seat one; and once the shape is right, every remaining
 * problem is about a named member the manager can substitute.
 *
 * Exactly one problem is returned — the first one found in that order. Fixing it
 * and re-submitting is one press, and a list of seven complaints about one
 * mistyped row is worse than the first complaint alone.
 *
 * @param category the entry's category (a copy, immutable on the entry row)
 * @param roster every member entered for this team, composed or not
 * @param composition the lines the manager dictated
 * @param eventDate the race night, as a local calendar date (`parseDateOnly`)
 */
export function validateComposition(
  category: TeamCategory,
  roster: CompositionSeat[],
  composition: CompositionRow[],
  eventDate: Date,
): CompositionVerdict {
  const rules = COMPOSITION[category];

  // ── structure ────────────────────────────────────────────────────────
  const seen = new Set<string>();
  for (const row of composition) {
    if (seen.has(row.userId)) return fail({ code: "duplicate", userId: row.userId });
    seen.add(row.userId);
  }

  const seats = new Map(roster.map((seat) => [seat.userId, seat]));
  for (const row of composition) {
    if (!seats.has(row.userId)) return fail({ code: "unknown_member", userId: row.userId });
  }

  const racers = composition.filter((r) => r.role === "racer");
  const aces = composition.filter((r) => r.role === "ace");
  const jokers = composition.filter((r) => r.role === "joker");
  if (
    racers.length !== rules.racers ||
    aces.length !== rules.pairs ||
    jokers.length !== rules.pairs
  ) {
    return fail({
      code: "role_counts",
      expected: { racers: rules.racers, pairs: rules.pairs },
      got: { racers: racers.length, aces: aces.length, jokers: jokers.length },
    });
  }

  // A RACER runs the whole mile alone: no pair, no handover point.
  for (const row of racers) {
    if (row.pairNo !== undefined || row.stageOption !== undefined) {
      return fail({ code: "pair_shape", pairNo: row.pairNo ?? 0 });
    }
  }

  // Every pair member must name a pair the category has and a stage option the
  // rules define.
  const pairMembers = [...aces, ...jokers];
  for (const row of pairMembers) {
    if (row.pairNo === undefined || row.pairNo < 1 || row.pairNo > rules.pairs) {
      return fail({ code: "pair_shape", pairNo: row.pairNo ?? 0 });
    }
    if (!isStageOption(row.stageOption)) {
      return fail({ code: "pair_shape", pairNo: row.pairNo });
    }
  }

  // …and each pair must be exactly one ACE and one JOKER agreeing on where the
  // handover happens. The pair declares one stage, not one stage each.
  for (let pairNo = 1; pairNo <= rules.pairs; pairNo += 1) {
    const members = pairMembers.filter((r) => r.pairNo === pairNo);
    if (members.length !== 2) return fail({ code: "pair_shape", pairNo });
    if (members.filter((r) => r.role === "ace").length !== 1) {
      return fail({ code: "pair_shape", pairNo });
    }
    if (members[0].stageOption !== members[1].stageOption) {
      return fail({ code: "pair_shape", pairNo });
    }
  }

  // ── people ───────────────────────────────────────────────────────────
  for (const row of composition) {
    // Non-null: every `userId` was resolved against `seats` above.
    const seat = seats.get(row.userId) as CompositionSeat;

    const requiredSex = row.role === "racer" ? rules.racerSex : rules.pairSex;
    if (requiredSex !== undefined && seat.sex !== requiredSex) {
      return fail({ code: "mixed_sex", userId: row.userId, role: row.role });
    }

    if (!seat.confirmed) return fail({ code: "unconfirmed", userId: row.userId });

    // `coerceToDate` first, not `meetsMinParticipantAge` straight off the row: a
    // `date` column comes back as UTC midnight, and comparing that in local time
    // lands a day early west of Greenwich (the #53 snapshot bug).
    const dob = coerceToDate(seat.dateOfBirth);
    if (dob === null || !meetsMinParticipantAge(dob, eventDate)) {
      return fail({ code: "underage", userId: row.userId });
    }
  }

  return { ok: true };
}
