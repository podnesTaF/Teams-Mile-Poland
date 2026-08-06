import { and, eq, gte, inArray, ne, sql } from "drizzle-orm";

import { contactInquiries, eventRegistrations, users } from "@/db/schema";
import { getDb } from "@/lib/db";

/** How far back the dashboard's "recent registrations" tile looks. */
export const RECENT_REGISTRATION_DAYS = 7;

export type OverviewStats = {
  totalUsers: number;
  verifiedUsers: number;
  newInquiries: number;
  /** Registration counts keyed by event slug, for the given series events. */
  registrationsByEvent: Map<string, number>;
  /**
   * Entries taken across those events in the last
   * {@link RECENT_REGISTRATION_DAYS} days — how fast the field is filling right
   * now, which the per-event totals alone do not say.
   */
  recentRegistrations: number;
};

/** Headline dashboard stats for the admin overview page. */
export async function getOverviewStats(eventSlugs: string[]): Promise<OverviewStats> {
  const db = getDb();
  const since = new Date(Date.now() - RECENT_REGISTRATION_DAYS * 24 * 60 * 60 * 1000);

  const [[userCounts], [inquiryCounts], registrationRows, [recentCounts]] = await Promise.all([
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
    eventSlugs.length > 0
      ? db
          .select({ count: sql<number>`count(*)::int` })
          .from(eventRegistrations)
          .where(
            and(
              inArray(eventRegistrations.eventSlug, eventSlugs),
              ne(eventRegistrations.status, "cancelled"),
              gte(eventRegistrations.createdAt, since),
            ),
          )
      : Promise.resolve([{ count: 0 }]),
  ]);

  const registrationsByEvent = new Map<string, number>();
  for (const row of registrationRows) registrationsByEvent.set(row.eventSlug, row.count);

  return {
    totalUsers: userCounts?.total ?? 0,
    verifiedUsers: userCounts?.verified ?? 0,
    newInquiries: inquiryCounts?.newCount ?? 0,
    registrationsByEvent,
    recentRegistrations: recentCounts?.count ?? 0,
  };
}
