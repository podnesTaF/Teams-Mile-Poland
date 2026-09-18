import { acerToMinor } from "./config";

/**
 * What a night costs to enter, read off the event and converted once (ADR 0013).
 *
 * Both entry paths — the runner's own registration and the manager's team entry
 * — ask these two functions and nothing else. The point is that "is this night
 * free?" has exactly one answer per path: the surface that renders the button,
 * the action that pre-checks the balance, and the transaction that takes the
 * money all read the same number through the same call, so a priced night can
 * never be shown as free or charged twice over.
 *
 * Whole ACER on the row, minor units out — the ledger counts minor units and
 * the admin types whole ACER, and this is the one place the two meet for a fee.
 * A missing column (an `EventSummary` built by an older code path, a legacy
 * event that predates the columns) is **free**, not an error: absent means
 * nobody priced it.
 *
 * Pure data, no database and no `server-only`: client islands import it to show
 * the price beside the button.
 */

/** The shape either helper needs — an `EventSummary`, or a row, or a literal. */
export type EntryPriced = {
  teamEntryFeeAcer?: number | null;
  individualEntryFeeAcer?: number | null;
};

/**
 * A price column as minor units. Negative and non-integer values are treated as
 * free rather than trusted: the column is `integer not null default 0` and the
 * admin form bounds it, so anything else is a hand-edited row, and charging a
 * negative fee would *pay* people to enter.
 */
function feeMinor(acer: number | null | undefined): number {
  if (!acer || !Number.isFinite(acer) || acer <= 0) return 0;
  return acerToMinor(Math.floor(acer));
}

/** What entering as a team costs here, in minor units. `0` means free. */
export function teamEntryFeeMinor(event: EntryPriced | null | undefined): number {
  return feeMinor(event?.teamEntryFeeAcer);
}

/** What registering alone costs here, in minor units. `0` means free. */
export function individualEntryFeeMinor(event: EntryPriced | null | undefined): number {
  return feeMinor(event?.individualEntryFeeAcer);
}
