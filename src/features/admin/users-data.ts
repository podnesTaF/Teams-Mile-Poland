import { and, eq, ilike, inArray, isNull, ne, or, sql, type SQL } from "drizzle-orm";

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
export type CompleteFilter = "complete" | "incomplete";

export type UserListFilters = {
  q?: string;
  verified?: VerifiedFilter;
  participation?: ParticipationFilter;
  registered?: RegisteredFilter;
  complete?: CompleteFilter;
};

/** Which users column the table is ordered by. */
export type UserSortKey = "name" | "signed-up";

export type UserSort = { key: UserSortKey; dir: "asc" | "desc" };

/**
 * Newest accounts first — the question the list is opened with is "who has
 * joined", and an alphabetical default buries today's signups in the middle of
 * the alphabet.
 */
export const DEFAULT_USER_SORT: UserSort = { key: "signed-up", dir: "desc" };

/** Which slice of the filtered list to return; omit for all of it. */
export type UserWindow = { sort?: UserSort; limit?: number; offset?: number };

export type UserListRow = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  /**
   * Whether the account carries every field {@link isProfileComplete} requires
   * (first name, last name, date of birth, sex, phone) — the same gate that
   * decides whether the runner can enter an event at all.
   */
  profileComplete: boolean;
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
 * The SQL twin of `isProfileComplete` (`src/lib/auth/user-session.ts`): the five
 * fields an event entry needs, each of them actually filled in.
 *
 * `nullif(btrim(…), '')` rather than a bare `is not null` because the TypeScript
 * predicate trims too — a profile whose phone is a space is not complete there,
 * and the admin count must not disagree with the gate the runner hits.
 */
const PROFILE_COMPLETE = sql`(
  nullif(btrim(${users.firstName}), '') is not null
  and nullif(btrim(${users.lastName}), '') is not null
  and ${users.dateOfBirth} is not null
  and ${users.sex} is not null
  and nullif(btrim(${users.phone}), '') is not null
)`;

/** What a person sorts under: surname, or the single-field name. */
const SORT_NAME = sql`coalesce(${users.lastName}, ${users.name})`;

/**
 * The `ORDER BY` for a sort choice, always ending in a total order: without the
 * id tiebreaker Postgres may place two accounts that tie on the sort key
 * differently between the query for page 1 and the query for page 2, so one is
 * shown twice and the other never.
 */
function userOrder(sort: UserSort): SQL[] {
  const dir = sort.dir === "desc" ? sql`desc` : sql`asc`;
  const primary: Record<UserSortKey, SQL> = {
    name: sql`${SORT_NAME} ${dir} nulls last`,
    "signed-up": sql`${users.createdAt} ${dir}`,
  };
  return [primary[sort.key], sql`${users.id} asc`];
}

/**
 * The per-user aggregates the list joins against, built once so the row read and
 * its count can filter on exactly the same shape.
 */
function userAggregates(db: ReturnType<typeof getDb>) {
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

  return { augAgg, ranAgg };
}

/** The `WHERE` a filter set means — shared by the page read and its count. */
function userFilters(
  filters: UserListFilters,
  augAgg: ReturnType<typeof userAggregates>["augAgg"],
): SQL[] {
  const clauses: SQL[] = [];

  const q = filters.q?.trim();
  if (q) {
    const like = `%${q}%`;
    // Phone matches the stored value as typed; normalising both sides to E.164
    // is task 08, and until then a fragment search is what the desk has.
    const search = or(
      ilike(users.name, like),
      ilike(users.email, like),
      ilike(users.phone, like),
    );
    if (search) clauses.push(search);
  }

  if (filters.verified) {
    const verified = eq(users.emailVerified, filters.verified === "verified");
    clauses.push(verified);
  }

  if (filters.complete === "complete") {
    clauses.push(sql`${PROFILE_COMPLETE}`);
  } else if (filters.complete === "incomplete") {
    clauses.push(sql`not ${PROFILE_COMPLETE}`);
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

  return clauses;
}

/**
 * All accounts with first-event participation and Aug-registration count,
 * filtered by search (name/email/phone), verified state, profile completeness,
 * first-event attendance, and whether they hold any Aug-series registration.
 *
 * Ordered by {@link DEFAULT_USER_SORT} — newest accounts first — unless the
 * caller passes a sort, and optionally windowed to one page. Filtering, sorting
 * and paging all happen in the database: the admin table is URL state over this
 * read, not a client-side table.
 */
export async function listUsers(
  filters: UserListFilters = {},
  window: UserWindow = {},
): Promise<UserListRow[]> {
  const db = getDb();
  const { augAgg, ranAgg } = userAggregates(db);
  const clauses = userFilters(filters, augAgg);

  const query = db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      emailVerified: users.emailVerified,
      firstName: users.firstName,
      lastName: users.lastName,
      phone: users.phone,
      profileComplete: sql<boolean>`${PROFILE_COMPLETE}`,
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
    .orderBy(...userOrder(window.sort ?? DEFAULT_USER_SORT));

  return window.limit === undefined
    ? query
    : query.limit(window.limit).offset(window.offset ?? 0);
}

/**
 * How many rows {@link listUsers} would return for the same filters, ignoring
 * any window — i.e. how many pages the table has.
 *
 * Separate from the read rather than a window function on it so the read keeps
 * returning plain `UserListRow[]`, and so an empty page costs one cheap count
 * instead of dragging every matching row back to decide there are none. The
 * joins are the read's, because the filters are over the joined columns.
 */
export async function countUsers(filters: UserListFilters = {}): Promise<number> {
  const db = getDb();
  const { augAgg } = userAggregates(db);
  const clauses = userFilters(filters, augAgg);

  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .leftJoin(
      legacyParticipations,
      and(
        eq(legacyParticipations.userId, users.id),
        eq(legacyParticipations.eventSlug, FIRST_EVENT_SLUG),
      ),
    )
    .leftJoin(augAgg, eq(augAgg.userId, users.id))
    .where(clauses.length ? and(...clauses) : undefined);
  return row?.count ?? 0;
}

export type UserStats = {
  /** Every account in the system, verified or not. */
  total: number;
  /** Accounts with a verified email (`users.emailVerified`). */
  verified: number;
  /**
   * Accounts that could enter an event today — every field `isProfileComplete`
   * requires is filled in. A verified email is a different fact and the two
   * counts overlap freely: an unverified account can have a complete profile.
   */
  profileComplete: number;
};

/** The headline totals shown above the users table, unaffected by filters. */
export async function getUserStats(): Promise<UserStats> {
  const [row] = await getDb()
    .select({
      total: sql<number>`count(*)::int`,
      verified: sql<number>`count(*) filter (where ${users.emailVerified})::int`,
      profileComplete: sql<number>`count(*) filter (where ${PROFILE_COMPLETE})::int`,
    })
    .from(users);
  return row ?? { total: 0, verified: 0, profileComplete: 0 };
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
