import { and, eq, inArray, ne, sql } from "drizzle-orm";

import { contactInquiries, eventRegistrations, users } from "@/db/schema";
import { getDb } from "@/lib/db";

export type OverviewStats = {
  totalUsers: number;
  verifiedUsers: number;
  newInquiries: number;
  /** Registration counts keyed by event slug, for the given series events. */
  registrationsByEvent: Map<string, number>;
};

/** Headline dashboard stats for the admin overview page. */
export async function getOverviewStats(eventSlugs: string[]): Promise<OverviewStats> {
  const db = getDb();

  const [[userCounts], [inquiryCounts], registrationRows] = await Promise.all([
    db
      .select({
        total: sql<number>`count(*)::int`,
        verified: sql<number>`count(*) filter (where ${users.emailVerified})::int`,
      })
      .from(users),
    db
      .select({ newCount: sql<number>`count(*)::int` })
      .from(contactInquiries)
      .where(eq(contactInquiries.status, "new")),
    eventSlugs.length > 0
      ? db
          .select({
            eventSlug: eventRegistrations.eventSlug,
            count: sql<number>`count(*)::int`,
          })
          .from(eventRegistrations)
          .where(
            and(
              inArray(eventRegistrations.eventSlug, eventSlugs),
              // `cancelled` is deprecated and never set; match getRosterStats,
              // which skips any legacy rows defensively.
              ne(eventRegistrations.status, "cancelled"),
            ),
          )
          .groupBy(eventRegistrations.eventSlug)
      : Promise.resolve([]),
  ]);

  const registrationsByEvent = new Map<string, number>();
  for (const row of registrationRows) registrationsByEvent.set(row.eventSlug, row.count);

  return {
    totalUsers: userCounts?.total ?? 0,
    verifiedUsers: userCounts?.verified ?? 0,
    newInquiries: inquiryCounts?.newCount ?? 0,
    registrationsByEvent,
  };
}
