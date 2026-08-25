/**
 * Bib slot lists — an explicit set of bib numbers an event may issue, replacing
 * the implicit `1..bibPool` range when the venue's box of bibs is not a neat
 * prefix. The race-day reality this models: the timing crew hands over "what's
 * left" — e.g. 101–115 plus a few strays — and check-in must issue exactly
 * those numbers and nothing else.
 *
 * The list is stored on the event as a normalized text spec (`"101-115, 203"`)
 * rather than a table: a slot carries no fact beyond its number, nothing joins
 * to it, and membership was always enforced in code (only *held* bibs are
 * DB-constrained, by the partial unique index of ADR 0003). Everything else
 * about bibs — leases, recycling, the waiting list — is number-agnostic and
 * unchanged.
 *
 * Pure functions of their input, like `event-schemas.ts`: parsing is validated
 * server-side on save, so the stored spec always round-trips through
 * {@link parseBibSlots} — a row that does not is a hand-edited column, and the
 * store treats it as "no list".
 */

/**
 * Upper bound on a single bib number. Four digits on purpose: the planned
 * heat-coded scheme (bib `XXYY` = heat 01–99 × chip slot 01–15) needs numbers
 * up to 9915, and a bound is what turns a fat-fingered `500000` into a flash
 * rather than driver trouble.
 */
export const MAX_BIB_NUMBER = 9999;

/** Upper bound on the list's size — same rationale as `MAX_BIB_POOL`. */
export const MAX_BIB_SLOTS = 5000;

/** One `N` or `N-M` token, hyphen or en-dash — specs get typed and pasted. */
const TOKEN = /^(\d{1,4})(?:\s*[-–]\s*(\d{1,4}))?$/;

/**
 * Parse a slot spec — bib numbers and ranges separated by commas, semicolons
 * or whitespace ("101-115, 203 205") — into the ascending, deduplicated list
 * it names. Returns `null` when any token is unreadable, a range runs
 * backwards, a number is outside `1..MAX_BIB_NUMBER`, the list is empty, or it
 * exceeds {@link MAX_BIB_SLOTS}: a spec that is partly wrong must refuse whole,
 * because silently issuing "most of" a list is how two runners get one bib.
 */
export function parseBibSlots(raw: string): number[] | null {
  const tokens = raw
    .split(/[\s,;]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  if (tokens.length === 0) return null;

  const slots = new Set<number>();
  for (const token of tokens) {
    const match = TOKEN.exec(token);
    if (!match) return null;
    const from = Number.parseInt(match[1], 10);
    const to = match[2] === undefined ? from : Number.parseInt(match[2], 10);
    if (from < 1 || to > MAX_BIB_NUMBER || from > to) return null;
    for (let bib = from; bib <= to; bib += 1) {
      slots.add(bib);
      if (slots.size > MAX_BIB_SLOTS) return null;
    }
  }
  return [...slots].sort((a, b) => a - b);
}

/**
 * The canonical spec for a slot list: consecutive runs collapsed to `a-b`,
 * single numbers plain, comma-separated, ascending. This is what the column
 * stores and every surface displays, so "101,102,103" and "101-103" save as
 * the same event.
 */
export function formatBibSlots(slots: readonly number[]): string {
  const parts: string[] = [];
  for (let i = 0; i < slots.length; ) {
    let j = i;
    while (j + 1 < slots.length && slots[j + 1] === slots[j] + 1) j += 1;
    parts.push(j === i ? String(slots[i]) : `${slots[i]}-${slots[j]}`);
    i = j + 1;
  }
  return parts.join(", ");
}
