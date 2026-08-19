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

/** One account a referrer brought in, with its own funnel numbers. */
export type ReferredUserRow = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  signedUpAt: Date;
  /** Non-cancelled series registrations this account holds. */
  raceRegistrations: number;
  /** Canonical races run (`src/lib/events/participation.ts`). */
  racesRun: number;
};

export type ReferrerDetail = {
  referrer: { id: string; name: string; email: string };
  /** Newest sign-up first — the freshest referral is the one to look at. */
  referred: ReferredUserRow[];
};

/**
 * The drill-down behind one row of {@link listReferrers}: who exactly this user
 * brought in, each with their own funnel numbers. Per-account rows rather than
 * the aggregate, so the desk can follow a referral to the person. Null when the
 * id is not a user at all; a user who referred nobody gets an empty list (the
 * page says so rather than 404ing, since the link can arrive from a stale tab).
 */
export async function getReferrerDetail(referrerId: string): Promise<ReferrerDetail | null> {
  const db = getDb();
  const [referrer] = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, referrerId))
    .limit(1);
  if (!referrer) return null;

  const referred = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      emailVerified: users.emailVerified,
      signedUpAt: users.createdAt,
      raceRegistrations: sql<number>`count(distinct ${eventRegistrations.id})`.mapWith(Number),
      racesRun: RACES_RUN_OVER_JOIN,
    })
    .from(users)
    .leftJoin(
      eventRegistrations,
      and(eq(eventRegistrations.userId, users.id), ne(eventRegistrations.status, "cancelled")),
    )
    .leftJoin(legacyParticipations, eq(legacyParticipations.userId, users.id))
    .where(eq(users.referredBy, referrerId))
    .groupBy(users.id, users.name, users.email, users.emailVerified, users.createdAt)
    .orderBy(desc(users.createdAt));

  return { referrer, referred };
}

/** A user's place in the referral graph, for the user-detail cross-links. */
export type ReferralLinks = {
  /** Who referred this account, when anyone did. */
  referredBy: { id: string; name: string } | null;
  /** How many accounts this user referred — links to the referrer detail. */
  invitedCount: number;
};

export async function getReferralLinks(userId: string): Promise<ReferralLinks> {
  const db = getDb();
  const referrer = alias(users, "referrer");
  const [row] = await db
    .select({
      referredById: referrer.id,
      referredByName: referrer.name,
      invitedCount: sql<number>`(
        select count(*) from ${users} invited where invited.referred_by = ${users.id}
      )`.mapWith(Number),
    })
    .from(users)
    .leftJoin(referrer, eq(referrer.id, users.referredBy))
    .where(eq(users.id, userId))
    .limit(1);
  if (!row) return { referredBy: null, invitedCount: 0 };
  return {
    referredBy:
      row.referredById && row.referredByName
        ? { id: row.referredById, name: row.referredByName }
        : null,
    invitedCount: row.invitedCount,
  };
}
