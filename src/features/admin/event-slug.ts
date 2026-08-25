import { like } from "drizzle-orm";

import { events } from "@/db/schema";
import { getDb } from "@/lib/db";

/**
 * The slug a new event is given, once, at creation.
 *
 * **A slug is immutable after creation, and that is what this module exists to
 * make true.** Six things key off `event_slug` as bare text with *no foreign
 * key*: `event_registrations`, `event_results`, `event_heats`, `event_media`,
 * `event_email_log`, and the signed ticket payload. Nothing in the database
 * would stop a rename and nothing would follow it either — the rows simply stop
 * matching, silently, and a runner's ticket stops resolving to their entry. The
 * last slug rename in this project (the cancelled 2026-08-08 night) meant moving
 * 11 registrations by hand. So the slug is derived here from the event's date
 * exactly once and never rewritten: the edit form shows it read-only, and
 * `updateEvent` does not touch the column.
 *
 * The accepted consequence, stated plainly because the admin UI states it too:
 * **an event whose date is edited after creation keeps a slug naming the old
 * date.** `mile-2026-09-05` moved to the 12th stays `mile-2026-09-05`. The slug
 * is a join key that happens to read like a date, not a display field — every
 * surface shows `EventSummary.date`, so a stale slug is cosmetic, whereas a
 * fresh one strands rows in six places. Cheap trade, taken deliberately.
 *
 * Only individual events are generated here. The legacy team event is
 * `warsaw-2026`, seeded from the old registry, and there is no admin flow that
 * mints another one.
 */

/** `mile-<YYYY-MM-DD>` — the shape every existing individual-event slug has. */
const SLUG_PREFIX = "mile-";

/**
 * Whether a value is a real `YYYY-MM-DD` calendar day.
 *
 * Exported so the create form's schema can refuse a bad date with a flash the
 * admin can act on, rather than letting {@link eventSlugForDate} throw. The
 * shape check alone would accept `2026-02-31`, so the day is round-tripped
 * through an explicit `Z` instant rather than `parseDateOnly`: we are comparing
 * strings here, not doing calendar math, and a local-midnight parse would
 * re-introduce the timezone a bare date does not have.
 */
export function isEventDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** The one place the refusal is worded, shared by both halves below. */
function assertEventDate(date: string): void {
  if (!isEventDate(date)) {
    throw new Error(`Cannot build an event slug from ${JSON.stringify(date)}: expected YYYY-MM-DD`);
  }
}

/**
 * The slug for an event on `date`, avoiding everything in `taken`.
 *
 * Pure, and takes the existing slugs as an argument for the same reason
 * `FlashContext` takes a resolved `bibPool` and `findUserResults` takes an
 * `eventsBySlug` map: the derivation is a string rule, the collision check is a
 * database read, and only one of those needs a database to test. The rule is
 * `mile-<date>`, then `-2`, `-3`, … until free — first collision gets `-2`
 * because the unsuffixed slug is conceptually the first, and a `-1` that means
 * "the second one" would be a trap for anyone reading the table.
 *
 * Unlike `slugify()`, which returns `""` for input it cannot use and leaves the
 * caller to notice, a malformed date **throws**. A news slug is editable while
 * the article is a draft; this one is permanent from the moment the row lands,
 * so `mile-2026-8-1` or `mile-undefined` is not a cosmetic defect to fix later.
 * Callers validate with {@link isEventDate} first; the throw is the backstop
 * that keeps a garbage slug out of six tables.
 */
export function eventSlugForDate(date: string, taken: ReadonlySet<string>): string {
  assertEventDate(date);
  const base = `${SLUG_PREFIX}${date}`;
  if (!taken.has(base)) return base;
  // Bounded by the number of events that could share one calendar day, so the
  // loop terminates on any real table; `n` starting at 2 is the `-2` rule above.
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/**
 * The slug for a new event on `date`, resolved against the `events` table.
 *
 * The thin async half: one query for the slugs that could possibly collide —
 * only the base's own family can, so the prefix filter is exact rather than an
 * optimisation — and then the pure rule above decides. `date` is validated here
 * as well as in the pure half, because it is about to be spliced into a `LIKE`
 * pattern; a bad one throws rather than being swallowed.
 *
 * **Fails loudly with no database, unlike every event read.** `store.ts` treats
 * an unreachable database as "no events" so the landing and the event pages
 * still build locally and in preview; that forgiveness is right for a read whose
 * worst case is a quieter page. It is wrong here. A slug this function cannot
 * verify as unique is not a degraded answer, it is a *plausible* one — it would
 * insert cleanly today (the primary key only catches an exact duplicate of a row
 * that is visible, and a failed read sees none) and hand a second event the join
 * key of the first. So this uses `getDb()`, which throws when `DATABASE_URL` is
 * unset, and lets a query failure propagate: an admin who cannot reach the
 * database must be told they cannot create an event, not given a slug. That is
 * the store's own rule — reads degrade, mutations are loud.
 */
export async function generateEventSlug(date: string): Promise<string> {
  // Before the query, not only inside the pure half: the date is form input and
  // it is about to become a `LIKE` pattern, where `%` and `_` are wildcards.
  assertEventDate(date);
  const rows = await getDb()
    .select({ slug: events.slug })
    .from(events)
    .where(like(events.slug, `${SLUG_PREFIX}${date}%`));
  return eventSlugForDate(date, new Set(rows.map((row) => row.slug)));
}
