import { and, desc, eq, ne, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { eventRegistrations, legacyParticipations, users } from "@/db/schema";
import { getDb } from "@/lib/db";
import { RACES_RUN_OVER_JOIN } from "@/lib/events/participation";

/**
 * Admin view of the referral program: one row per user who has referred at
 * least one account, with the funnel counts (sign-ups → race registrations →
 * races run). Derived entirely from `users.referred_by` joins — there is no
 * separate tracking table.
 */
export type ReferrerRow = {
  id: string;
  name: string;
  email: string;
  signups: number;
  raceRegistrations: number;
  /**
   * Races the referred accounts actually ran, per the one canonical definition
   * (`src/lib/events/participation.ts`) — the same number `getReferralStats`
   * shows the referrer on their own profile.
   */
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
      // `distinct` throughout: the two left joins below are independently
      // one-to-many per referred account and so multiply each other's rows.
      raceRegistrations: sql<number>`count(distinct ${eventRegistrations.id})`.mapWith(Number),
      participations: RACES_RUN_OVER_JOIN,
    })
    .from(users)
    .innerJoin(referred, eq(referred.referredBy, users.id))
    .leftJoin(
      eventRegistrations,
      and(eq(eventRegistrations.userId, referred.id), ne(eventRegistrations.status, "cancelled")),
    )
    .leftJoin(legacyParticipations, eq(legacyParticipations.userId, referred.id))
    .groupBy(users.id, users.name, users.email)
    .orderBy(desc(signups), users.name);
}
