/**
 * Leasing one bib to one registration — the check-in desk's inventory step,
 * extracted from `checkin-actions.ts` so team check-in can run it in a loop
 * (PRD #64, Cross-Cutting Decision 7).
 *
 * A bib is a **lease**, not an identity (ADR 0003): the venue has a fixed set of
 * chipped numbers, a finished heat returns them, and the next runner wears one
 * of the same numbers. Everything in here follows from that — the lowest free
 * number rather than `max + 1`, membership of `getBibSlots` rather than a range
 * check, and an exhausted pool that is a *state* ("pending") rather than a
 * failure, because a runner standing at the desk is never blocked by inventory.
 *
 * This module deliberately owns no SQL. The two writes that a check-in funnels
 * through stay in `events-data.ts` (`checkInWithBib`, `checkInWithoutBib`),
 * because those two UPDATEs are also where the ACER accrual hangs (PRD #44) and
 * a third write site would silently mint or skip rewards. What lives here is the
 * *decision procedure* over them, which is what had to be shared.
 *
 * ## Standalone vs. inside a transaction
 *
 * `leaseBib` without `tx` behaves exactly as the individual desk always has: one
 * write per press, a short retry loop when another desk takes the suggested
 * number first.
 *
 * With `tx` the retry loop is **useless and must not be relied on**: in
 * Postgres a unique violation aborts the entire transaction, so the failed
 * `INSERT`/`UPDATE` cannot be followed by another statement on the same
 * transaction. A caller leasing N bibs atomically therefore:
 *
 *   1. calls {@link pickFreeBibs} to choose N numbers up front,
 *   2. calls {@link leaseBib} once per member with an explicit `bib`,
 *   3. and on `bib_held` (or any unique violation) **retries the whole
 *      transaction**, because a concurrent desk took one of the numbers.
 *
 * That is the shape team check-in uses, with pair members served before RACERS
 * so the zone timing always has chips to read (PRD #64 user story 31).
 */

import { getBibSlots } from "@/lib/events/registry";
import type { DbExecutor } from "@/lib/db";

import {
  checkInWithBib,
  checkInWithoutBib,
  freeBibs,
  getHeldBib,
  isUniqueViolation,
  suggestNextBib,
} from "./events-data";

/**
 * How many times to re-suggest a bib when another desk takes the one we were
 * given. Only a genuine two-desk race gets here — an exhausted pool is reported
 * as such and never retried. Ignored when running inside a transaction, where a
 * unique violation has already aborted everything (see the module comment).
 */
export const LEASE_ATTEMPTS = 5;

/**
 * What one lease attempt did.
 *
 * - `bib` — leased, runner checked in wearing that number.
 * - `pending` — the pool is exhausted; the runner is checked in bib-less and
 *   joins the waiting list (ADR 0003). **Not a failure.**
 * - `race` — every suggestion was taken by another desk while numbers were
 *   still free. Nothing was written; the desk presses again.
 * - `bib_held` — the *explicitly chosen* number is on somebody else. Surfaced
 *   rather than retried: the admin picked that number on purpose.
 * - `bib_invalid` — the explicitly chosen number is not one this event issues.
 *   Membership of `getBibSlots`, not a range: an event may issue an explicit
 *   slot list ("101-115, 203"), and a typed number outside it is exactly the
 *   mistake this refusal exists to catch.
 */
export type LeaseOutcome =
  | { ok: "bib"; bib: number }
  | { ok: "pending" }
  | { ok: "race" }
  | { ok: "bib_held" }
  | { ok: "bib_invalid" };

export type LeaseOptions = {
  /**
   * The number the admin typed, or the one the caller picked with
   * {@link pickFreeBibs}. Accepts the raw form value: blank, whitespace, `null`
   * and `undefined` all mean "lease the lowest free number", and anything that
   * is not an integer this event issues is `bib_invalid`.
   */
  bib?: number | string | null;
  /** Run every read and write inside this open transaction. */
  tx?: DbExecutor;
};

/**
 * Lease a bib and mark one registration present — the per-registration half of
 * the contract's `assignBibAndCheckIn` (PRD #26).
 *
 * With an explicit `bib`: one attempt, conflicts surfaced. Without one: a bib
 * already held from the heat builder is confirmed rather than stacked on top of
 * a second number, otherwise the lowest free number is leased with a short retry
 * loop, and an exhausted pool checks the runner in bib-less.
 *
 * Never throws for an inventory problem — every one of those is an outcome. A
 * unique violation on an explicit number is `bib_held`; anything else (a lost
 * connection, a constraint we do not know about) propagates, because guessing
 * about a half-written check-in is worse than a 500 the admin can retry.
 */
export async function leaseBib(
  eventSlug: string,
  registrationId: string,
  { bib = null, tx }: LeaseOptions = {},
): Promise<LeaseOutcome> {
  const chosen = typeof bib === "number" ? bib : String(bib ?? "").trim();

  if (chosen !== "") {
    const explicit = typeof chosen === "number" ? chosen : Number.parseInt(chosen, 10);
    if (!Number.isInteger(explicit) || !(await getBibSlots(eventSlug)).includes(explicit)) {
      return { ok: "bib_invalid" };
    }
    try {
      await checkInWithBib(registrationId, explicit, tx);
    } catch (error) {
      if (isUniqueViolation(error)) return { ok: "bib_held" };
      throw error;
    }
    return { ok: "bib", bib: explicit };
  }

  // A bib pre-assigned in the heat builder is already this runner's lease —
  // checking in confirms it rather than stacking a second number on top.
  const held = await getHeldBib(registrationId, tx);
  if (held !== null) {
    await checkInWithBib(registrationId, held, tx);
    return { ok: "bib", bib: held };
  }

  for (let attempt = 0; attempt < LEASE_ATTEMPTS; attempt += 1) {
    const next = await suggestNextBib(eventSlug, tx);
    if (next === null) {
      await checkInWithoutBib(registrationId, tx);
      return { ok: "pending" };
    }
    try {
      await checkInWithBib(registrationId, next, tx);
      return { ok: "bib", bib: next };
    } catch (error) {
      if (isUniqueViolation(error)) continue;
      throw error;
    }
  }
  return { ok: "race" };
}

/**
 * The `n` lowest free bibs for an event, ascending — fewer than `n` when the
 * pool is short, empty when it is exhausted.
 *
 * The transaction-safe way to lease several numbers at once: pick them all
 * first, then lease each explicitly, then retry the whole transaction if one was
 * taken meanwhile. Reading the free list inside the transaction (`tx`) is what
 * makes the picks distinct from each other *and* from leases the same
 * transaction has already written.
 *
 * A short return is not an error — the caller decides who gets a real number and
 * who is checked in bib-pending, and for a team that order is pairs first
 * (PRD #64 user story 31).
 */
export async function pickFreeBibs(
  eventSlug: string,
  n: number,
  tx?: DbExecutor,
): Promise<number[]> {
  if (n <= 0) return [];
  return (await freeBibs(eventSlug, tx)).slice(0, n);
}
