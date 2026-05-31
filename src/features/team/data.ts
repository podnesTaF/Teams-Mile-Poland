import { and, asc, count, eq, gt } from "drizzle-orm";

import { magicLinks, runners, teams } from "@/db/schema";
import { getDb } from "@/lib/db";

import { MAX_TEAM_SIZE } from "./constants";

export type TeamRow = typeof teams.$inferSelect;
export type RunnerRow = typeof runners.$inferSelect;

export function isCaptainRunner(runner: RunnerRow) {
  return runner.registrationType === "captain";
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function normalizeTeamCode(code: string) {
  return code.trim().toUpperCase();
}

export async function getTeamByCode(code: string): Promise<TeamRow | null> {
  const db = getDb();
  const normalized = normalizeTeamCode(code);
  const [team] = await db.select().from(teams).where(eq(teams.code, normalized)).limit(1);
  return team ?? null;
}

export async function findRunnerByEmail(
  teamId: string,
  email: string,
): Promise<RunnerRow | null> {
  const db = getDb();
  const normalized = normalizeEmail(email);
  const [runner] = await db
    .select()
    .from(runners)
    .where(and(eq(runners.teamId, teamId), eq(runners.email, normalized)))
    .limit(1);
  return runner ?? null;
}

export type TeamRoster = {
  captain: RunnerRow | null;
  members: RunnerRow[];
  count: number;
  capacity: number;
};

export async function getRosterByTeamId(teamId: string): Promise<TeamRoster> {
  const db = getDb();
  const rows = await db
    .select()
    .from(runners)
    .where(eq(runners.teamId, teamId))
    .orderBy(asc(runners.createdAt));

  const captain = rows.find(isCaptainRunner) ?? null;
  const members = rows.filter((r) => !isCaptainRunner(r));
  return {
    captain,
    members,
    count: rows.length,
    capacity: MAX_TEAM_SIZE,
  };
}

export async function countRecentMagicLinks(
  teamId: string,
  email: string,
  windowMs: number,
) {
  const db = getDb();
  const since = new Date(Date.now() - windowMs);
  const [row] = await db
    .select({ value: count() })
    .from(magicLinks)
    .where(
      and(
        eq(magicLinks.teamId, teamId),
        eq(magicLinks.email, normalizeEmail(email)),
        gt(magicLinks.createdAt, since),
      ),
    );
  return row?.value ?? 0;
}
