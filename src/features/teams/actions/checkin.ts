"use server";

import { getHeatRunState, markHeatStartedRow } from "@/features/admin/heats-data";
import { revalidateStartList } from "@/features/event-heats/start-list";
import type { AdminCapability } from "@/lib/auth/roles";
import { getUser, isAdmin, userCan, type SessionUser } from "@/lib/auth/user-session";
import { parseDateOnly } from "@/lib/age";
import { getEventBySlug } from "@/lib/events/registry";
import { isSeriesEvent } from "@/lib/events/types";

import {
  checkInTeamRows,
  swapComposedRows,
  type TeamCheckInLease,
} from "../checkin-service";
import { teamFailure, type TeamActionFailure } from "../config";
import { getEntryMembers, getEntryWithTeam, type EntryMemberView } from "../entries";
import {
  isRaceRole,
  isStageOption,
  validateComposition,
  type CompositionProblem,
  type CompositionRow,
  type CompositionSeat,
} from "../rating-rules";

/**
 * Team check-in (#69): the race-day actions of PRD #64's Contracts —
 * `checkInTeam`, `swapComposed`, plus the `markHeatStarted` stamp the swap
 * deadline needs (brief Decision 1).
 *
 * Each is gate → refusals → validator → service, the shape every other team
 * action has. The rows live in `../checkin-service`, the rules in
 * `../rating-rules`, and nothing here writes a query of its own.
 *
 * ## Why these three do not use `requireAdmin`
 *
 * The admin *pages* call `requireAdmin(locale, …)`, which redirects a signed-out
 * visitor and 404s a level that is too low — the right answer for a document
 * request. These are called from a client island that renders the refusal next
 * to the control that was pressed, so they answer in the team feature's frozen
 * failure shape instead (`{ ok: false, reason, message }` via `teamFailure`),
 * with `auth` for signed out and `forbidden` for an insufficient level. Same
 * decision, different medium: a JSON-shaped refusal an island can word beats a
 * thrown redirect it has to guess at.
 *
 * The capability split is the PRD's: **check-in and swap are `checkin`** (the
 * volunteer desk role), **withdraw is `edit`** — and withdraw is not here at
 * all, because it is the manager's own `withdrawEntry` (#67), whose guard
 * already admits an admin holding `edit` (user story 35). Adding a second
 * withdraw would be a second place the "refused once checked in" rule could
 * drift.
 */

/**
 * A refusal that can carry the composition problem that caused it.
 *
 * `invalid_composition` is one reason key with seven sub-reasons (PRD #64 user
 * story 29: "with the specific reason"), and the reason set is frozen in
 * `config.ts` — so the sub-reason travels beside the key as the validator's own
 * `problem`, and the surface words it. `consent_pending` carries it too: it
 * *is* the validator's `unconfirmed` problem under the reason the PRD names for
 * it, and the desk needs to know which member.
 */
export type CheckinFailure = TeamActionFailure & { problem?: CompositionProblem };

export type CheckinActionResult<T = object> = ({ ok: true } & T) | CheckinFailure;

/**
 * One line of the composition as it arrives from the browser — every field
 * `unknown`-shaped on purpose. A client island is not a trust boundary: the
 * island validates so the manager gets an answer without a round-trip, and
 * this re-reads every value from scratch (PRD #64 user story 42 — one
 * validator, two callers).
 */
export type CompositionInput = {
  userId?: unknown;
  role?: unknown;
  pairNo?: unknown;
  stageOption?: unknown;
};

/** The desk's admin gate, in the failure shape an island can render. */
async function requireCapability(
  capability: AdminCapability,
): Promise<{ ok: true; user: SessionUser } | TeamActionFailure> {
  const user = await getUser();
  if (!user) return teamFailure("auth");
  if (!isAdmin(user) || !userCan(user, capability)) return teamFailure("forbidden");
  return { ok: true, user };
}

/**
 * Read the browser's composition into {@link CompositionRow}s, or refuse.
 *
 * `pairNo` and `stageOption` are dropped when absent rather than passed through
 * as `null`: the validator treats a RACER carrying either as a `pair_shape`
 * mistake, and an empty `<select>` submitting `""` must not become one.
 */
function readComposition(input: unknown): CompositionRow[] | null {
  if (!Array.isArray(input)) return null;
  const rows: CompositionRow[] = [];
  for (const raw of input as CompositionInput[]) {
    if (!raw || typeof raw !== "object") return null;
    const userId = raw.userId;
    if (typeof userId !== "string" || userId === "") return null;
    if (!isRaceRole(raw.role)) return null;

    const row: CompositionRow = { userId, role: raw.role };
    const pairNo =
      typeof raw.pairNo === "number"
        ? raw.pairNo
        : typeof raw.pairNo === "string" && raw.pairNo !== ""
          ? Number.parseInt(raw.pairNo, 10)
          : null;
    if (pairNo !== null) {
      if (pairNo !== 1 && pairNo !== 2) return null;
      row.pairNo = pairNo;
    }
    if (raw.stageOption !== undefined && raw.stageOption !== null && raw.stageOption !== "") {
      if (!isStageOption(raw.stageOption)) return null;
      row.stageOption = raw.stageOption;
    }
    rows.push(row);
  }
  return rows;
}

/** The roster in the validator's shape. `confirmed` is `consent_pending = false`. */
function toSeats(members: EntryMemberView[]): CompositionSeat[] {
  return members.map((member) => ({
    userId: member.userId,
    sex: member.sex,
    dateOfBirth: member.dateOfBirth,
    confirmed: member.confirmed,
  }));
}

/**
 * Turn a composition verdict into the refusal the PRD names.
 *
 * `unconfirmed` is its own reason (`consent_pending`) rather than a sub-reason
 * of `invalid_composition`: the composition is legal, the *member* is not
 * admissible yet, and the desk's next move is to hand them their phone rather
 * than to re-dictate roles. Everything else keeps `invalid_composition` with
 * the problem attached.
 */
function compositionRefusal(problem: CompositionProblem): CheckinFailure {
  const reason = problem.code === "unconfirmed" ? "consent_pending" : "invalid_composition";
  return { ...teamFailure(reason), problem };
}

/**
 * Check a team in with a named composition (user stories 28–32, 34).
 *
 * The guard order is the one a human would explain a refusal in: you are not on
 * the desk → that entry does not exist → that night is off → this team is
 * already checked in → the composition breaks a rule → this member has not
 * confirmed. Everything after that is inventory, and inventory never refuses
 * (ADR 0003): a short pool checks the runners past the end of the free list in
 * bib-pending and **names them in the result**, so the desk can say so out loud
 * (user story 31, and the issue's "the desk is told").
 *
 * Age is judged on the **event date** (`parseDateOnly(event.date)`, PRD #64
 * decision 7), exactly as entry and confirmation are.
 */
export async function checkInTeam(
  entryId: string,
  composition: CompositionInput[],
): Promise<
  CheckinActionResult<{
    /** Composed members checked in with no bib — the pool ran out. */
    pending: string[];
    /** Every composed member's number, in the order they were served. */
    leases: TeamCheckInLease[];
    heatNumber: number | null;
  }>
> {
  const gate = await requireCapability("checkin");
  if (!gate.ok) return gate;
  if (!entryId || typeof entryId !== "string") return teamFailure("invalid");

  const found = await getEntryWithTeam(entryId);
  if (!found) return teamFailure("notfound");
  if (found.entry.status !== "entered") return teamFailure("already_checked_in");

  const event = await getEventBySlug(found.entry.eventSlug);
  if (!event || !isSeriesEvent(event)) return teamFailure("notfound");
  if (event.status === "cancelled") return teamFailure("cancelled");

  const rows = readComposition(composition);
  if (rows === null) return teamFailure("invalid");

  const members = await getEntryMembers(entryId);
  const verdict = validateComposition(
    found.entry.category,
    toSeats(members),
    rows,
    parseDateOnly(event.date),
  );
  if (!verdict.ok) return compositionRefusal(verdict.problem);

  const written = await checkInTeamRows({
    entryId,
    eventSlug: found.entry.eventSlug,
    members,
    composition: rows,
  });
  if (!written.ok) return written;

  // The public start list groups a team event by team and role (this slice), so
  // a check-in genuinely changes it — unlike an individual check-in, which
  // changes no bib-free page (PRD #26).
  revalidateStartList();

  console.info(
    `[teams] entry ${entryId} checked in for ${found.entry.eventSlug}: ` +
      `${written.leases.length} composed, ${written.pending.length} bib-pending, ` +
      `heat ${written.heatNumber ?? "none"}`,
  );

  return {
    ok: true,
    pending: written.pending,
    leases: written.leases,
    heatNumber: written.heatNumber,
  };
}

/**
 * Swap an absent composed member for a Reserve (user story 33).
 *
 * Refused once the heat has been sent off (`heat_started`) — including a
 * finished one, which has started by definition — because after the gun the
 * composition is what ran. Refused when the runner coming in is not a reserve
 * on this entry (`not_reserve`): the swap is the reserve mechanism, not a
 * general re-composition, and re-dictating the whole composition after check-in
 * is deliberately not offered.
 *
 * The resulting composition goes back through the same validator, so a swap can
 * never produce a team the desk would have been refused at check-in — a JOKER
 * swapped in for an ACE's pair, or a man into a mixed team's pair.
 */
export async function swapComposed(
  entryId: string,
  outUserId: string,
  inUserId: string,
): Promise<CheckinActionResult<{ bib: number | null }>> {
  const gate = await requireCapability("checkin");
  if (!gate.ok) return gate;
  if (!entryId || !outUserId || !inUserId) return teamFailure("invalid");
  if (outUserId === inUserId) return teamFailure("invalid");

  const found = await getEntryWithTeam(entryId);
  if (!found) return teamFailure("notfound");
  // Nothing to swap before check-in: there is no composition yet, and the
  // manager's own add/remove is the tool for a roster change (#67).
  if (found.entry.status !== "checked_in") return teamFailure("invalid");

  if (found.entry.heatId) {
    const heat = await getHeatRunState(found.entry.heatId);
    if (heat && (heat.startedAt || heat.finishedAt)) return teamFailure("heat_started");
  }

  const event = await getEventBySlug(found.entry.eventSlug);
  if (!event || !isSeriesEvent(event)) return teamFailure("notfound");

  const members = await getEntryMembers(entryId);
  const outgoing = members.find((member) => member.userId === outUserId);
  const incoming = members.find((member) => member.userId === inUserId);
  if (!outgoing || !incoming) return teamFailure("notfound");
  if (outgoing.isReserve || !outgoing.raceRole) return teamFailure("invalid");
  if (!incoming.isReserve) return teamFailure("not_reserve");

  // The composition as it would be after the swap: every composed seat except
  // the one leaving, plus the reserve in that seat.
  const rows: CompositionRow[] = members
    .filter((member) => !member.isReserve && member.raceRole && member.userId !== outUserId)
    .map((member) => composedRow(member.userId, member))
    .concat([composedRow(inUserId, outgoing)]);

  const verdict = validateComposition(
    found.entry.category,
    toSeats(members),
    rows,
    parseDateOnly(event.date),
  );
  if (!verdict.ok) return compositionRefusal(verdict.problem);

  const swapped = await swapComposedRows({
    entryId,
    eventSlug: found.entry.eventSlug,
    outgoing,
    incoming,
    heatId: found.entry.heatId,
  });
  if (!swapped.ok) return swapped;

  revalidateStartList();
  console.info(
    `[teams] entry ${entryId}: ${outUserId} → ${inUserId} as ${swapped.role}` +
      `${swapped.bib === null ? " (no bib)" : `, bib ${swapped.bib}`}`,
  );

  return { ok: true, bib: swapped.bib };
}

/**
 * One composed seat as a validator row, taking its race fields from `source` —
 * the same seat for an unchanged member, the outgoing seat for the reserve
 * inheriting it.
 */
function composedRow(userId: string, source: EntryMemberView): CompositionRow {
  const row: CompositionRow = {
    userId,
    // Non-null at every call site: only seats with a role reach here.
    role: source.raceRole as NonNullable<EntryMemberView["raceRole"]>,
  };
  if (source.pairNo === 1 || source.pairNo === 2) row.pairNo = source.pairNo;
  if (source.stageOption) row.stageOption = source.stageOption;
  return row;
}

/**
 * Stamp a heat as started — the swap deadline (brief Decision 1).
 *
 * `checkin`, not `edit`: it is a race-night observation made by whoever is
 * standing at the start, which is exactly the volunteer desk role, and it is
 * the same capability that marks a heat finished.
 */
export async function markHeatStarted(
  heatId: string,
): Promise<CheckinActionResult<{ heatNumber: number }>> {
  const gate = await requireCapability("checkin");
  if (!gate.ok) return gate;
  if (!heatId || typeof heatId !== "string") return teamFailure("invalid");

  const outcome = await markHeatStartedRow(heatId);
  if (outcome.result === "missing") return teamFailure("notfound");
  // Already started (or already finished) and never published are both "that
  // heat cannot be started now"; the reason set is frozen, so both are
  // `heat_started` — the state the desk is being told about.
  if (outcome.result === "already") return teamFailure("heat_started");
  if (outcome.result === "not-published") return teamFailure("invalid");

  return { ok: true, heatNumber: outcome.number };
}
