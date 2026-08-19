import { and, eq } from "drizzle-orm";

import { legacyParticipations } from "@/db/schema";
import { getDb } from "@/lib/db";
import { RAN_LEGACY_RACE } from "@/lib/events/participation";

/**
 * Event slugs of legacy (pre-accounts) events this user is recorded as having
 * attended — the link persisted by `scripts/import-first-event.ts`. Feeds the
 * profile's results matching alongside live event_registrations, and (one slug
 * per legacy race run) the legacy half of the profile's canonical "races run"
 * stat — hence the shared {@link RAN_LEGACY_RACE} predicate.
 */
export async function getAttendedLegacySlugs(userId: string): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .select({ eventSlug: legacyParticipations.eventSlug })
    .from(legacyParticipations)
    .where(and(eq(legacyParticipations.userId, userId), RAN_LEGACY_RACE));
  return rows.map((r) => r.eventSlug);
}
