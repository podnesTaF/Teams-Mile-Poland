import { eq, sql, type SQL } from "drizzle-orm";

import { eventRegistrations, legacyParticipations, type ParticipationStatus } from "@/db/schema";
import type { getDb } from "@/lib/db";

/**
 * The one definition of "races participated in" (task 11).
 *
 * **Canonical:** a user has *run* a race when either
 * - a series `event_registrations` row for them reached `checked_in` — the
 *   admin's on-site verification that they were at the start line, the only
 *   status that records arrival — or
 * - a `legacy_participations` row for them has `attended = true`, the imported
 *   equivalent for events that predate the `users` table (`warsaw-2026`).
 *
 * Deliberately **not** part of it: holding a registration. `registered` and
 * `confirmed` are intent, not attendance, and `no_show` is the recorded
 * opposite. A registration count is a different, useful fact — count it
 * separately and name it "registrations", never "races".
 *
 * Decision note: three disagreeing definitions shipped before this module
 * (non-cancelled registrations on the profile, checked-in + legacy in the admin
 * users list, checked-in only in the referral funnels). The recommendation in
 * `planning/admin-cabinet-tasks/11-unify-participation-definition.md` —
 * checked-in **plus** legacy attended — was implemented without owner
 * confirmation, since the owner was unavailable; it is the only one of the three
 * that neither over-counts intent nor silently drops the first event's runners.
 * If the owner later rules differently, this file is the single place to change.
 *
 * Kept a thin set of query building blocks on purpose: callers still write their
 * own joins, because each surface groups by something different (one user, all
 * users, referrers). What they must not do is restate the predicates.
 */

/** The registration status that means "was at the start line". */
export const RAN_STATUS: ParticipationStatus = "checked_in";

/** The canonical predicate over an `event_registrations` row. */
export const RAN_SERIES_RACE = eq(eventRegistrations.status, RAN_STATUS);

/** The canonical predicate over a `legacy_participations` row. */
export const RAN_LEGACY_RACE = eq(legacyParticipations.attended, true);

/**
 * The TypeScript twin of {@link RAN_SERIES_RACE}, for callers that already hold
 * the rows (the profile page reads its registrations anyway, so counting them in
 * memory beats a second round trip). Both sides read `RAN_STATUS`, so they
 * cannot drift apart.
 */
export function isRaceRun(status: ParticipationStatus | string): boolean {
  return status === RAN_STATUS;
}

/**
 * Per-user "races run" as two joinable aggregates plus the expression that adds
 * them up. Two subqueries rather than one join because the two tables are
 * independently one-to-many per user: joining both directly would multiply rows.
 *
 * ```ts
 * const { seriesAgg, legacyAgg, racesRun } = racesRunPerUser(db);
 * db.select({ raceCount: racesRun }).from(users)
 *   .leftJoin(seriesAgg, eq(seriesAgg.userId, users.id))
 *   .leftJoin(legacyAgg, eq(legacyAgg.userId, users.id));
 * ```
 */
export function racesRunPerUser(db: ReturnType<typeof getDb>) {
  const seriesAgg = db
    .select({
      userId: eventRegistrations.userId,
      count: sql<number>`count(*)::int`.as("series_ran_count"),
    })
    .from(eventRegistrations)
    .where(RAN_SERIES_RACE)
    .groupBy(eventRegistrations.userId)
    .as("series_ran_agg");

  const legacyAgg = db
    .select({
      userId: legacyParticipations.userId,
      count: sql<number>`count(*)::int`.as("legacy_ran_count"),
    })
    .from(legacyParticipations)
    .where(RAN_LEGACY_RACE)
    .groupBy(legacyParticipations.userId)
    .as("legacy_ran_agg");

  const racesRun = sql<number>`(coalesce(${seriesAgg.count}, 0) + coalesce(${legacyAgg.count}, 0))`;

  return { seriesAgg, legacyAgg, racesRun };
}

/**
 * "Races run" for a query that has already left-joined **both**
 * `event_registrations` and `legacy_participations` and groups by someone else
 * (the referral funnels group by referrer).
 *
 * `count(distinct id)` is load-bearing: two one-to-many joins in the same query
 * multiply each other's rows, so a plain `count` would report a runner with 3
 * registrations and 1 legacy race as having run 4 series races. Any sibling
 * count in such a query needs `distinct` for the same reason.
 */
export const RACES_RUN_OVER_JOIN: SQL<number> = sql<number>`(
  count(distinct ${eventRegistrations.id}) filter (where ${RAN_SERIES_RACE})
  + count(distinct ${legacyParticipations.id}) filter (where ${RAN_LEGACY_RACE})
)::int`;
