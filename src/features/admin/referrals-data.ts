import { and, desc, eq, ne, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { eventRegistrations, users } from "@/db/schema";
import { getDb } from "@/lib/db";

/**
 * Admin view of the referral program: one row per user who has referred at
 * least one account, with the funnel counts (sign-ups → race registrations →
 * checked in). Derived entirely from `users.referred_by` joins — there is no
 * separate tracking table.
 */
export type ReferrerRow = {
  id: string;
  name: string;
  email: string;
  signups: number;
  raceRegistrations: number;
  participations: number;
};

export async function listReferrers(): Promise<ReferrerRow[]> {
  const db = getDb();
  const referred = alias(users, "referred");
  const signups = sql<number>`count(distinct ${referred.id})`.mapWith(Number);
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      signups,
      raceRegistrations: sql<number>`count(${eventRegistrations.id})`.mapWith(Number),
      participations: sql<number>`count(${eventRegistrations.id}) filter (where ${eventRegistrations.status} = 'checked_in')`.mapWith(
        Number,
      ),
    })
    .from(users)
    .innerJoin(referred, eq(referred.referredBy, users.id))
    .leftJoin(
      eventRegistrations,
      and(eq(eventRegistrations.userId, referred.id), ne(eventRegistrations.status, "cancelled")),
    )
    .groupBy(users.id, users.name, users.email)
    .orderBy(desc(signups), users.name);
}
