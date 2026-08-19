/**
 * Desk-facing copy for the race-morning flow, in one place.
 *
 * Two surfaces run the same check-in — the check-in desk and the inline admin
 * panel on a scanned ticket page — and they report through the same flash codes.
 * Keeping the sentences here stops the two from drifting into telling an admin
 * two different things about the same outcome. English-only, like every admin
 * surface.
 */

/**
 * How a walk-up's placement landed, appended to a check-in confirmation.
 * `heat` is a heat number, or `none` when no published heat had room.
 */
export function placementText(heat: string | undefined): string {
  if (!heat) return "";
  return heat === "none"
    ? " No published heat had room — they are on the Unplaced list, to be placed from the heat builder."
    : ` Seeded into heat ${heat}.`;
}

/** Confirmation copy for a check-in. `code` is a bib number or `pending`. */
export function checkedInText(code: string, heat: string | undefined): string {
  return code === "pending"
    ? `Checked in · bib pending. No bibs available — mark a finished heat complete to free some.${placementText(heat)}`
    : `Checked in · bib #${code}.${placementText(heat)}`;
}

/**
 * Confirmation copy for every race-morning success, keyed by the `?ok=` code the
 * action redirected with — or `null` when the code is not this family's.
 *
 * Two kinds live here. A check-in reports the *number* (`ok=12`, or `pending`),
 * which is why {@link checkedInText} takes a value rather than a code; the two
 * status reversals report named codes like every other action in the panel. Both
 * are now pressed from either surface (slice #45), so both are worded once, here.
 *
 * Declining is load-bearing: a hand-edited or stale `?ok=` must render no
 * feedback at all rather than a sentence about a bib nobody was handed.
 */
export function checkinOkText(code: string, heat: string | undefined): string | null {
  if (code === "noshow") {
    return "Marked no-show. Any bib they were holding is back in the pool.";
  }
  if (code === "registered") {
    return "Back to registered — not checked in. Any bib they were holding is back in the pool.";
  }
  if (code === "pending" || /^\d+$/.test(code)) {
    return checkedInText(code, heat);
  }
  return null;
}

/**
 * Desk-facing copy for a refused action. Bib exhaustion at check-in is
 * deliberately absent: it is not an error — check-in succeeds bib-less and
 * reports through the confirmation instead.
 */
export function checkinErrorText(
  code: string,
  opts: { pool: number; bibs?: string } = { pool: 0 },
): string | null {
  switch (code) {
    case "bib_held":
      return "Another runner is holding that bib right now. Choose another.";
    case "bib":
      return `Enter a bib number between 1 and ${opts.pool}.`;
    case "bib_race":
      return "Another desk took that bib first. Try again.";
    case "pool_empty":
      return "No bibs are free — mark a finished heat complete first.";
    case "not_waiting":
      return "That runner is not waiting for a bib — they are either not checked in, or their heat has already run.";
    case "heat_missing":
      return "That heat no longer exists — it may have been deleted in another tab.";
    case "heat_finished":
      return "That heat is already marked finished.";
    case "heat_draft":
      return "That heat has not been published yet, so it has not been run. Publish the card first.";
    case "heat_open":
      return "That heat is not finished, so there is nothing to un-finish.";
    case "bib_reused":
      return `Cannot un-finish that heat: bib ${
        opts.bibs?.split(",").join(", ") || "numbers it freed"
      } already went to another runner. Nothing was changed — undo that check-in first, or leave the heat finished.`;
    case "input":
      return "Missing runner or event.";
    case "scan":
      return "Invalid or unverified ticket QR.";
    default:
      return null;
  }
}
