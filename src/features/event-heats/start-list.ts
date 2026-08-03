import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { eventHeats, eventRegistrations, users } from "@/db/schema";
import { getDb } from "@/lib/db";

/**
 * The public start list: what a spectator sees at
 * `/[locale]/events/[slug]/heats`.
 *
 * Read model only — the admin builder's own view of the card lives in
 * `features/admin/heats-data.ts` and carries fill counts, notify state and
 * everything else the desk needs. This module is deliberately the narrow public
 * projection of the same rows: **no bibs** (PRD #26), no email, no status.
 *
 * The bib omission is what keeps this page cheap to cache: because a bib never
 * appears, checking a runner in cannot change the page, so only publish /
 * heat-edit / finish invalidate it (see {@link revalidateStartList}).
 */

/** One runner as the start list names them. */
export type StartListEntry = {
  registrationId: string;
  name: string;
  club: string | null;
};

/** One published heat, with its runners in alphabetical order. */
export type StartListHeat = {
  number: number;
  scheduledAt: Date;
  entries: StartListEntry[];
};

/**
 * An event's start list plus the one fact the page needs to tell its two empty
 * states apart: whether the event has any heats at all.
 *
 * - `totalHeats === 0` — nothing has been built; the page shows its empty state.
 * - `totalHeats > 0` with no `heats` — the card exists but is still draft, which
 *   is the explicit "not published yet" state, not an empty one.
 */
export type StartList = {
  totalHeats: number;
  heats: StartListHeat[];
};

/**
 * Published heats for an event with their runners.
 *
 * **Published only.** A draft heat is admin work-in-progress that nobody has
 * been emailed about; releasing it early would contradict the notification the
 * moment the card was rebalanced.
 *
 * **Deliberately not filtered by `status`.** Filtering out (say) a `no_show`
 * would make the page's content depend on a column that only check-in and the
 * roster actions write — and those must not invalidate this page (PRD #26: the
 * page is invalidated by publish / heat-edit / finish alone). A cached page plus
 * a status filter is a filter that does not actually run: the row would sit there
 * until the next heat mutation. So the projection depends on exactly the two
 * things that do invalidate it — which heats are published, and who is in them.
 * A runner who should not appear is taken off the card by unassigning them, which
 * is a heat edit and does invalidate.
 */
export async function getEventStartList(eventSlug: string): Promise<StartList> {
  const db = getDb();

  const heats = await db
    .select({
      id: eventHeats.id,
      number: eventHeats.number,
      scheduledAt: eventHeats.scheduledAt,
      publishedAt: eventHeats.publishedAt,
    })
    .from(eventHeats)
    .where(eq(eventHeats.eventSlug, eventSlug))
    .orderBy(asc(eventHeats.number));

  const published = heats.filter((h) => h.publishedAt !== null);
  if (published.length === 0) {
    return { totalHeats: heats.length, heats: [] };
  }

  const rows = await db
    .select({
      registrationId: eventRegistrations.id,
      heatId: eventRegistrations.heatId,
      firstName: users.firstName,
      lastName: users.lastName,
      fallbackName: users.name,
      club: users.club,
    })
    .from(eventRegistrations)
    .innerJoin(users, eq(eventRegistrations.userId, users.id))
    .where(
      and(
        eq(eventRegistrations.eventSlug, eventSlug),
        isNotNull(eventRegistrations.heatId),
        inArray(
          eventRegistrations.heatId,
          published.map((h) => h.id),
        ),
      ),
    )
    .orderBy(asc(users.lastName), asc(users.firstName));

  const byHeat = new Map<string, StartListEntry[]>();
  for (const row of rows) {
    if (!row.heatId) continue;
    const entry: StartListEntry = {
      registrationId: row.registrationId,
      name: [row.firstName, row.lastName].filter(Boolean).join(" ") || row.fallbackName,
      club: row.club,
    };
    const list = byHeat.get(row.heatId);
    if (list) list.push(entry);
    else byHeat.set(row.heatId, [entry]);
  }

  return {
    totalHeats: heats.length,
    heats: published.map((h) => ({
      number: h.number,
      scheduledAt: h.scheduledAt,
      entries: byHeat.get(h.id) ?? [],
    })),
  };
}

/**
 * Invalidate the public start list after a heat mutation.
 *
 * The route-pattern form (`[locale]` / `[slug]` as dynamic segments) covers
 * pl/en/ua and every event in one call — the same idiom the news actions use.
 * This is what makes the page server-rendered-then-cached rather than dynamic on
 * every request: publish, heat edit and finish call it, check-in does not,
 * because no bib is displayed (PRD #26 cross-cutting decision 4).
 *
 * Lives here rather than in `heat-actions.ts` so the race-morning actions can
 * reuse it — a `"use server"` module may only export async actions. **`markHeatFinished`
 * / `unmarkHeatFinished` (slice #32) must call this too**: finishing a heat is the
 * third mutation the contract names, and it does not exist yet.
 */
export function revalidateStartList(): void {
  revalidatePath("/[locale]/events/[slug]/heats", "page");
}
