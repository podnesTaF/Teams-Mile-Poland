import { desc, eq, inArray } from "drizzle-orm";

import { broadcasts, emailLog, magicLinks, runners, teams } from "@/db/schema";
import { getDb } from "@/lib/db";

export type TeamSummary = {
  id: string;
  code: string;
  name: string;
  size: number | null;
  status: string;
  runnerCount: number;
  createdAt: Date;
};

export type RunnerSummary = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  registrationType: string;
  paymentStatus: string;
  createdAt: Date;
};

export type LegacyOverview = {
  teams: TeamSummary[];
  runners: RunnerSummary[];
};

/** The frozen warsaw-2026 teams + runners tables, newest first. */
export async function getLegacyOverview(): Promise<LegacyOverview> {
  const db = getDb();

  const [teamRows, runnerRows] = await Promise.all([
    db.select().from(teams).orderBy(desc(teams.createdAt)),
    db.select().from(runners).orderBy(desc(runners.createdAt)),
  ]);

  const countsByTeam = new Map<string, number>();
  for (const r of runnerRows) {
    if (r.teamId) countsByTeam.set(r.teamId, (countsByTeam.get(r.teamId) ?? 0) + 1);
  }

  const teamSummaries: TeamSummary[] = teamRows.map((t) => ({
    id: t.id,
    code: t.code,
    name: t.name,
    size: t.size,
    status: t.status,
    runnerCount: countsByTeam.get(t.id) ?? 0,
    createdAt: t.createdAt,
  }));

  const runnerSummaries: RunnerSummary[] = runnerRows.map((r) => ({
    id: r.id,
    fullName: r.fullName,
    email: r.email,
    phone: r.phone,
    registrationType: r.registrationType,
    paymentStatus: r.paymentStatus,
    createdAt: r.createdAt,
  }));

  return { teams: teamSummaries, runners: runnerSummaries };
}

/**
 * Remove a runner and any magic links pointing at them. (magic_links has a
 * FK to runners, so those rows must go first.)
 */
export async function deleteRunnerCascade(runnerId: string) {
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx.delete(emailLog).where(eq(emailLog.runnerId, runnerId));
    await tx.delete(magicLinks).where(eq(magicLinks.runnerId, runnerId));
    await tx.delete(runners).where(eq(runners.id, runnerId));
  });
}

/**
 * Remove a team along with its runners and every magic link referencing the
 * team or those runners — ordered to satisfy the foreign keys. Broadcasts that
 * targeted the team are kept (they're send history) with their team reference
 * detached, since broadcasts.team_id has no cascade.
 */
export async function deleteTeamCascade(teamId: string) {
  const db = getDb();
  await db.transaction(async (tx) => {
    const teamRunners = await tx
      .select({ id: runners.id })
      .from(runners)
      .where(eq(runners.teamId, teamId));
    const runnerIds = teamRunners.map((r) => r.id);

    await tx.update(broadcasts).set({ teamId: null }).where(eq(broadcasts.teamId, teamId));
    await tx.delete(magicLinks).where(eq(magicLinks.teamId, teamId));
    if (runnerIds.length > 0) {
      await tx.delete(emailLog).where(inArray(emailLog.runnerId, runnerIds));
      await tx.delete(magicLinks).where(inArray(magicLinks.runnerId, runnerIds));
    }
    await tx.delete(runners).where(eq(runners.teamId, teamId));
    await tx.delete(teams).where(eq(teams.id, teamId));
  });
}
