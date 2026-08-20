import { mile20260801Results } from "./results/mile-2026-08-01";
import { warsaw2026Results } from "./results/warsaw-2026";
import type { EventResults } from "./types";

/**
 * Hand-transcribed results sheets, by slug — the one part of an event that is
 * still genuinely config. These are the pre-timing-system races whose results
 * were typed up from paper into a TS literal; there is no admin flow that could
 * have produced them and no reason to migrate them into `event_results`.
 *
 * A slug absent here is not missing results: `results-data.ts` prefers the
 * `event_results` table, which is where the timing system's imports land. The
 * 2026-08-15 morning is exactly that case — it ran, it has results, and it has
 * no sheet here.
 *
 * Lives in its own module rather than in `registry.ts` so the reader can import
 * it without a cycle: `registry.ts` re-exports the selectors from `store.ts`,
 * and `store.ts` needs these sheets to map a row to an `EventSummary`.
 */
export const RESULTS_SHEETS: Record<string, EventResults> = {
  "warsaw-2026": warsaw2026Results,
  "mile-2026-08-01": mile20260801Results,
};
