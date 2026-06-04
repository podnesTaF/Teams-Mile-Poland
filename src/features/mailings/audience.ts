import { eq, type SQL } from "drizzle-orm";

import { runners, teams } from "@/db/schema";
import { getDb } from "@/lib/db";
import type { LifecycleKind, MailLocale } from "@/emails/lifecycle/copy";

export type Recipient = {
  id: string;
  email: string;
  fullName: string;
  locale: MailLocale;
  teamId: string | null;
  teamCode: string | null;
  teamName: string | null;
  registrationType: string;
  remaining?: number;
};

export type Segment = "all" | "captains" | "team_members" | "free_agents" | "team";

function asMailLocale(value: string): MailLocale {
  return value === "pl" || value === "en" || value === "ua" ? value : "ua";
}

const MAX_TEAM_SIZE = 12;

/** Base runner + (optional) team columns, mapped to Recipient. */
async function selectRunners(where?: SQL) {
  const db = getDb();
  const rows = await db
    .select({
      id: runners.id,
      email: runners.email,
      fullName: runners.fullName,
      locale: runners.locale,
      registrationType: runners.registrationType,
      teamId: runners.teamId,
      teamCode: teams.code,
      teamName: teams.name,
    })
    .from(runners)
    .leftJoin(teams, eq(runners.teamId, teams.id))
    .where(where);

  return rows.map(
    (r): Recipient => ({
      id: r.id,
      email: r.email,
      fullName: r.fullName,
      locale: asMailLocale(r.locale),
      teamId: r.teamId,
      teamCode: r.teamCode,
      teamName: r.teamName,
      registrationType: r.registrationType,
    }),
  );
}

/** Captains whose roster is not yet full (count < declared size). */
export async function incompleteCaptains(): Promise<Recipient[]> {
  const db = getDb();
  const captains = await selectRunners(eq(runners.registrationType, "captain"));

  const result: Recipient[] = [];
  for (const captain of captains) {
    if (!captain.teamId) continue;
    const teamRunners = await db
      .select({ id: runners.id })
      .from(runners)
      .where(eq(runners.teamId, captain.teamId));
    const [team] = await db
      .select({ size: teams.size })
      .from(teams)
      .where(eq(teams.id, captain.teamId))
      .limit(1);
    const cap = team?.size ?? MAX_TEAM_SIZE;
    const remaining = cap - teamRunners.length;
    if (remaining > 0) result.push({ ...captain, remaining });
  }
  return result;
}

/** Who should receive a given lifecycle email. */
export async function eligibleForKind(kind: LifecycleKind): Promise<Recipient[]> {
  if (kind === "captain_incomplete") return incompleteCaptains();
  // All scheduled reminders go to every registered runner.
  return selectRunners();
}

/** Resolve a broadcast segment to recipients. */
export async function recipientsForSegment(
  segment: Segment,
  teamId?: string | null,
): Promise<Recipient[]> {
  switch (segment) {
    case "captains":
      return selectRunners(eq(runners.registrationType, "captain"));
    case "team_members":
      return selectRunners(eq(runners.registrationType, "team_member"));
    case "free_agents":
      return selectRunners(eq(runners.registrationType, "free_agent"));
    case "team":
      return teamId ? selectRunners(eq(runners.teamId, teamId)) : [];
    case "all":
    default:
      return selectRunners();
  }
}
