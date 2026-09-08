import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { users } from "@/db/schema/auth";
import {
  userTeamMembers,
  userTeams,
  type UserTeamMemberRow,
  type UserTeamRow,
} from "@/db/schema/user-teams";
import { getDb } from "@/lib/db";

import type { TeamCategory, TeamRole, TeamSex } from "./config";
import {
  computeCompleteness,
  type EligibilityCandidate,
  type RosterSeat,
  type TeamCompleteness,
} from "./eligibility";

/**
 * Read helpers for team formation. **Later slices add functions here; they never
 * change an existing signature** — #60, #61, #62 and #63 all import from this
 * module.
 *
 * Nothing in here decides anything: eligibility lives in `eligibility.ts`, the
 * gate chain in `guards.ts`. These are queries.
 */

/** A roster seat with the display fields the member view needs. */
export type RosterMember = RosterSeat & {
  role: TeamRole;
  category: TeamCategory;
  joinedAt: Date;
  firstName: string | null;
  lastName: string | null;
  /** First + last, falling back to the account name and then the email. */
  displayName: string;
  email: string;
};

/** One line of the profile's "My teams" list. */
export type MyTeamSummary = {
  team: UserTeamRow;
  role: TeamRole;
  completeness: TeamCompleteness;
};

export async function getTeamBySlug(slug: string): Promise<UserTeamRow | null> {
  const db = getDb();
  const rows = await db.select().from(userTeams).where(eq(userTeams.slug, slug)).limit(1);
  return rows[0] ?? null;
}

/**
 * Codes are stored upper-case and typed by hand, so the lookup folds case —
 * a runner reading a code off a phone screen should not be refused for it.
 */
export async function getTeamByCode(code: string): Promise<UserTeamRow | null> {
  const db = getDb();
  const normalized = code.trim().toUpperCase();
  if (!normalized) return null;
  const rows = await db.select().from(userTeams).where(eq(userTeams.code, normalized)).limit(1);
  return rows[0] ?? null;
}

/** Is this name already taken, case-insensitively? Optionally excluding one team. */
export async function findTeamByName(
  name: string,
  excludeTeamId?: string,
): Promise<UserTeamRow | null> {
  const db = getDb();
  const where = excludeTeamId
    ? and(sql`lower(${userTeams.name}) = lower(${name})`, sql`${userTeams.id} <> ${excludeTeamId}`)
    : sql`lower(${userTeams.name}) = lower(${name})`;
  const rows = await db.select().from(userTeams).where(where).limit(1);
  return rows[0] ?? null;
}

/** The roster, manager first then by join order. Names are for members and admin only. */
export async function getTeamRoster(teamId: string): Promise<RosterMember[]> {
  const db = getDb();
  const rows = await db
    .select({
      userId: userTeamMembers.userId,
      role: userTeamMembers.role,
      category: userTeamMembers.category,
      joinedAt: userTeamMembers.joinedAt,
      firstName: users.firstName,
      lastName: users.lastName,
      name: users.name,
      email: users.email,
      sex: users.sex,
    })
    .from(userTeamMembers)
    .innerJoin(users, eq(users.id, userTeamMembers.userId))
    .where(eq(userTeamMembers.teamId, teamId))
    .orderBy(userTeamMembers.joinedAt);

  return rows
    .map((row) => ({
      userId: row.userId,
      role: row.role,
      category: row.category,
      joinedAt: row.joinedAt,
      firstName: row.firstName,
      lastName: row.lastName,
      displayName:
        [row.firstName, row.lastName].filter(Boolean).join(" ").trim() || row.name || row.email,
      email: row.email,
      sex: (row.sex ?? null) as TeamSex | null,
    }))
    .sort((a, b) => {
      if (a.role !== b.role) return a.role === "manager" ? -1 : 1;
      return a.joinedAt.getTime() - b.joinedAt.getTime();
    });
}

export async function getTeamMembership(
  teamId: string,
  userId: string,
): Promise<UserTeamMemberRow | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(userTeamMembers)
    .where(and(eq(userTeamMembers.teamId, teamId), eq(userTeamMembers.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

/** The categories a runner already holds — the third argument to `checkEligibility`. */
export async function getUserTeamCategories(userId: string): Promise<TeamCategory[]> {
  const db = getDb();
  const rows = await db
    .select({ category: userTeamMembers.category })
    .from(userTeamMembers)
    .where(eq(userTeamMembers.userId, userId));
  return rows.map((row) => row.category);
}

/**
 * The candidate record `checkEligibility` wants, assembled in one place so the
 * invitation door and the request door build it identically. Returns `null`
 * when the account does not exist.
 */
export async function getEligibilityCandidate(
  userId: string,
): Promise<EligibilityCandidate | null> {
  const db = getDb();
  const [row] = await db
    .select({ id: users.id, sex: users.sex })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!row) return null;
  return {
    userId: row.id,
    sex: (row.sex ?? null) as TeamSex | null,
    categories: await getUserTeamCategories(userId),
  };
}

/**
 * Every team the runner is on, newest first, with the completeness the profile
 * card shows. Two queries regardless of how many teams: the memberships (with
 * the team rows), then every seat of those teams for the counts.
 */
export async function getMyTeams(userId: string): Promise<MyTeamSummary[]> {
  const db = getDb();
  const mine = await db
    .select({ team: userTeams, role: userTeamMembers.role })
    .from(userTeamMembers)
    .innerJoin(userTeams, eq(userTeams.id, userTeamMembers.teamId))
    .where(eq(userTeamMembers.userId, userId))
    .orderBy(desc(userTeams.createdAt));

  if (mine.length === 0) return [];

  const seatsByTeam = await getRosterSeats(mine.map((row) => row.team.id));

  return mine.map((row) => ({
    team: row.team,
    role: row.role,
    completeness: computeCompleteness(row.team.category, seatsByTeam.get(row.team.id) ?? []),
  }));
}

/**
 * Seats (id + sex only, no names) for several teams at once — what completeness
 * needs on list surfaces where roster names must not be read.
 */
export async function getRosterSeats(teamIds: string[]): Promise<Map<string, RosterSeat[]>> {
  const byTeam = new Map<string, RosterSeat[]>();
  if (teamIds.length === 0) return byTeam;

  const db = getDb();
  const rows = await db
    .select({
      teamId: userTeamMembers.teamId,
      userId: userTeamMembers.userId,
      role: userTeamMembers.role,
      sex: users.sex,
    })
    .from(userTeamMembers)
    .innerJoin(users, eq(users.id, userTeamMembers.userId))
    .where(inArray(userTeamMembers.teamId, teamIds));

  for (const row of rows) {
    const seats = byTeam.get(row.teamId) ?? [];
    seats.push({ userId: row.userId, role: row.role, sex: (row.sex ?? null) as TeamSex | null });
    byTeam.set(row.teamId, seats);
  }
  return byTeam;
}

/**
 * The manager's **first name only** — the one personal detail the public card
 * carries (PRD #57, "Public surfaces show no roster names").
 */
export async function getManagerFirstName(managerUserId: string): Promise<string | null> {
  const db = getDb();
  const [row] = await db
    .select({ firstName: users.firstName, name: users.name })
    .from(users)
    .where(eq(users.id, managerUserId))
    .limit(1);
  if (!row) return null;
  return row.firstName?.trim() || row.name.split(" ")[0] || null;
}
