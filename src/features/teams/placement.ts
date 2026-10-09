import { and, asc, eq, inArray } from "drizzle-orm";

import { userTeamMembers, userTeams } from "@/db/schema/user-teams";
import { executor, type DbExecutor } from "@/lib/db";

import {
  isPlacementTeamSlug,
  PLACEMENT_TEAM_COLOURS,
  PLACEMENT_TEAM_SLUGS,
  type PlacementTeamSlug,
  type RaceFormat,
} from "./config";

/**
 * Which race a runner registers for (ADR 0016, PRD #81): the **team** race when
 * they are on a placement roster at the moment they register, the
 * **individual** mile otherwise. One reader, every registration write path —
 * `registerForEvent`, the Stripe fulfilment (through the payload the action
 * parked) and the admin comp `createFreeRegistration` — so no path writes a
 * race literal of its own.
 */

/** A runner's placement team, with what a ticket or a card prints for it. */
export type PlacementTeam = {
  teamId: string;
  slug: PlacementTeamSlug;
  /** The team's full name ("Ace Battle Mile RED Warsaw"). */
  name: string;
  /** Its colour, printed as the short label ("RED"). */
  label: "RED" | "BLACK";
};

/** The two registration columns, as every writer sets them. */
export type RaceAssignment = { raceFormat: RaceFormat; teamId: string | null };

/**
 * The runner's membership in a placement team, or `null`. A runner is on at
 * most one team per category (`user_team_members_user_category_uq`) and the
 * placement teams are men's and women's, so two matches is not a real case;
 * should it ever happen the earliest membership wins — the same order the
 * migration 0031 backfill used.
 *
 * `tx` composes it into the caller's transaction (`DbExecutor` idiom).
 */
export async function placementTeamFor(
  userId: string,
  tx?: DbExecutor,
): Promise<PlacementTeam | null> {
  const [row] = await executor(tx)
    .select({ teamId: userTeams.id, slug: userTeams.slug, name: userTeams.name })
    .from(userTeamMembers)
    .innerJoin(userTeams, eq(userTeams.id, userTeamMembers.teamId))
    .where(
      and(
        eq(userTeamMembers.userId, userId),
        inArray(userTeams.slug, [...PLACEMENT_TEAM_SLUGS]),
      ),
    )
    .orderBy(asc(userTeamMembers.joinedAt), asc(userTeamMembers.id))
    .limit(1);
  return row ? toPlacementTeam(row) : null;
}

/** The registration columns for a runner's placement team (or its absence). */
export function raceOf(team: PlacementTeam | null): RaceAssignment {
  return team ? { raceFormat: "team", teamId: team.teamId } : { raceFormat: "individual", teamId: null };
}

/** {@link placementTeamFor} and {@link raceOf} in one call, for writers. */
export async function raceFor(
  userId: string,
  tx?: DbExecutor,
): Promise<RaceAssignment & { team: PlacementTeam | null }> {
  const team = await placementTeamFor(userId, tx);
  return { ...raceOf(team), team };
}

/**
 * Placement teams by id, for the surfaces that print a registration's race
 * (ticket, profile card, confirmation email). Ids that are not a placement
 * team are simply absent.
 */
export async function placementTeamsById(
  teamIds: Array<string | null | undefined>,
  tx?: DbExecutor,
): Promise<Map<string, PlacementTeam>> {
  const ids = [...new Set(teamIds.filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) return new Map();
  const rows = await executor(tx)
    .select({ teamId: userTeams.id, slug: userTeams.slug, name: userTeams.name })
    .from(userTeams)
    .where(inArray(userTeams.id, ids));
  const out = new Map<string, PlacementTeam>();
  for (const row of rows) {
    const team = toPlacementTeam(row);
    if (team) out.set(team.teamId, team);
  }
  return out;
}

function toPlacementTeam(row: { teamId: string; slug: string; name: string }): PlacementTeam | null {
  if (!isPlacementTeamSlug(row.slug)) return null;
  return {
    teamId: row.teamId,
    slug: row.slug,
    name: row.name,
    label: PLACEMENT_TEAM_COLOURS[row.slug],
  };
}
