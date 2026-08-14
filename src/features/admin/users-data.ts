import { and, asc, eq, ilike, inArray, isNull, ne, or, sql } from "drizzle-orm";

import { eventRegistrations, legacyParticipations, users } from "@/db/schema";
import { getDb } from "@/lib/db";
import { getEventBySlug, getSeriesEvents } from "@/lib/events/registry";
import type { ParticipationStatus } from "@/db/schema";

/**
 * The first event predates the `users` table; its registrants live in the
 * frozen legacy `runners` table and are surfaced through `legacy_participations`
 * (written by the first-event import). Attendance is keyed by this slug.
 */
export const FIRST_EVENT_SLUG = "warsaw-2026";

/** Aug-2026 individual-series event slugs — "Aug events" in the PRD. */
function augEventSlugs(): string[] {
  return getSeriesEvents().map((e) => e.slug);
}

export type VerifiedFilter = "verified" | "unverified";
export type ParticipationFilter = "attended" | "no_show";
export type RegisteredFilter = "registered" | "not_registered";

export type UserListFilters = {
  q?: string;
  verified?: VerifiedFilter;
  participation?: ParticipationFilter;
  registered?: RegisteredFilter;
};

export type UserListRow = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  firstName: string | null;
  lastName: string | null;
  /** true = attended, false = no-show, null = no first-event participation. */
  firstEventAttended: boolean | null;
  augRegistrationCount: number;
  /**
   * Races actually run: legacy participations attended + series registrations
   * that reached `checked_in` — the same "participated" definition the
   * referral stats use.
   */
  raceCount: number;
  /** Account registration date. */
  createdAt: Date;
};

/**
 * All accounts with first-event participation and Aug-registration count,
 * filtered by search (name/email), verified state, first-event attendance, and
 * whether they hold any Aug-series registration. Newest accounts first.
 */
export async function listUsers(filters: UserListFilters = {}): Promise<UserListRow[]> {
  const db = getDb();
  const augSlugs = augEventSlugs();

  // Per-user Aug-series registration count (deprecated `cancelled` excluded).
  const augAgg = db
    .select({
      userId: eventRegistrations.userId,
      count: sql<number>`count(*)::int`.as("aug_count"),
    })
    .from(eventRegistrations)
    .where(
      and(
        augSlugs.length > 0 ? inArray(eventRegistrations.eventSlug, augSlugs) : sql`false`,
        ne(eventRegistrations.status, "cancelled"),
      ),
    )
    .groupBy(eventRegistrations.userId)
    .as("aug_agg");

  // Per-user count of series races actually run (status reached `checked_in`,
  // any event slug). The legacy first event is added per-row below — one user
  // has at most one legacy participation.
  const ranAgg = db
    .select({
      userId: eventRegistrations.userId,
      count: sql<number>`count(*)::int`.as("ran_count"),
    })
    .from(eventRegistrations)
    .where(eq(eventRegistrations.status, "checked_in"))
    .groupBy(eventRegistrations.userId)
    .as("ran_agg");

  const clauses = [];

  const q = filters.q?.trim();
  if (q) {
    const like = `%${q}%`;
    const search = or(ilike(users.name, like), ilike(users.email, like));
    if (search) clauses.push(search);
  }

  if (filters.verified) {
    clauses.push(eq(users.emailVerified, filters.verified === "verified"));
  }

  // Left-joined `attended` is NULL when the user has no first-event row, so an
  // equality check naturally excludes non-participants from both branches.
  if (filters.participation === "attended") {
    clauses.push(eq(legacyParticipations.attended, true));
  } else if (filters.participation === "no_show") {
    clauses.push(eq(legacyParticipations.attended, false));
  }

  // The aggregate row exists only when the count is > 0.
  if (filters.registered === "registered") {
    clauses.push(sql`${augAgg.userId} is not null`);
  } else if (filters.registered === "not_registered") {
    clauses.push(isNull(augAgg.userId));
  }

  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      emailVerified: users.emailVerified,
      firstName: users.firstName,
      lastName: users.lastName,
      firstEventAttended: legacyParticipations.attended,
      augRegistrationCount: sql<number>`coalesce(${augAgg.count}, 0)`,
      raceCount: sql<number>`coalesce(${ranAgg.count}, 0) + (${legacyParticipations.attended} is true)::int`,
      createdAt: users.createdAt,
    })
    .from(users)
    .leftJoin(
      legacyParticipations,
      and(
        eq(legacyParticipations.userId, users.id),
        eq(legacyParticipations.eventSlug, FIRST_EVENT_SLUG),
      ),
    )
    .leftJoin(augAgg, eq(augAgg.userId, users.id))
    .leftJoin(ranAgg, eq(ranAgg.userId, users.id))
    .where(clauses.length ? and(...clauses) : undefined)
    .orderBy(asc(users.name));
}

export type UserStats = {
  /** Every account in the system, verified or not. */
  total: number;
  /** Accounts with a verified email (`users.emailVerified`). */
  verified: number;
};

/** The headline totals shown above the users table, unaffected by filters. */
export async function getUserStats(): Promise<UserStats> {
  const [row] = await getDb()
    .select({
      total: sql<number>`count(*)::int`,
      verified: sql<number>`count(*) filter (where ${users.emailVerified})::int`,
    })
    .from(users);
  return row ?? { total: 0, verified: 0 };
}

export type UserProfile = typeof users.$inferSelect;

/** One entry in a user's unioned event history (legacy + series). */
export type UserHistoryEntry = {
  kind: "legacy" | "series";
  eventSlug: string;
  eventName: string;
  /** Event date (`YYYY-MM-DD`) from the registry, for chronological sorting. */
  date: string;
  /** Legacy: attended / no-show. Series: participation status. */
  status: string;
  bib: number | null;
  registeredAt: Date;
};

export type UserDetail = {
  user: UserProfile;
  history: UserHistoryEntry[];
};

/** A single account with its full, chronological event history, or null. */
export async function getUserDetail(id: string): Promise<UserDetail | null> {
  const db = getDb();

  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!user) return null;

  const [legacyRows, registrationRows] = await Promise.all([
    db
      .select()
      .from(legacyParticipations)
      .where(eq(legacyParticipations.userId, id)),
    db
      .select()
      .from(eventRegistrations)
      .where(
        and(
          eq(eventRegistrations.userId, id),
          ne(eventRegistrations.status, "cancelled"),
        ),
      ),
  ]);

  const eventName = (slug: string) => getEventBySlug(slug)?.name ?? slug;
  const eventDate = (slug: string) => getEventBySlug(slug)?.date ?? "";

  const history: UserHistoryEntry[] = [
    ...legacyRows.map((r) => ({
      kind: "legacy" as const,
      eventSlug: r.eventSlug,
      eventName: eventName(r.eventSlug),
      date: eventDate(r.eventSlug),
      status: r.attended ? "attended" : "no_show",
      bib: null,
      registeredAt: r.createdAt,
    })),
    ...registrationRows.map((r) => ({
      kind: "series" as const,
      eventSlug: r.eventSlug,
      eventName: eventName(r.eventSlug),
      date: eventDate(r.eventSlug),
      status: r.status as ParticipationStatus,
      bib: r.bib,
      registeredAt: r.createdAt,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  return { user, history };
}
