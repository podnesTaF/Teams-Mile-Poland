import { and, eq } from "drizzle-orm";

import { legacyParticipations } from "@/db/schema";
import { getDb } from "@/lib/db";

/**
 * Event slugs of legacy (pre-accounts) events this user is recorded as having
 * attended — the link persisted by `scripts/import-first-event.ts`. Feeds the
 * profile's results matching alongside live event_registrations.
 */
export async function getAttendedLegacySlugs(userId: string): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .select({ eventSlug: legacyParticipations.eventSlug })
    .from(legacyParticipations)
    .where(and(eq(legacyParticipations.userId, userId), eq(legacyParticipations.attended, true)));
  return rows.map((r) => r.eventSlug);
}
