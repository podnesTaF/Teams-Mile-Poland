import { desc, eq, inArray } from "drizzle-orm";

import { contactInquiries, magicLinks, runners, teams } from "@/db/schema";
import { getDb } from "@/lib/db";

export type InquiryRow = typeof contactInquiries.$inferSelect;

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
  teamId: string | null;
  createdAt: Date;
};

export type AdminOverview = {
  inquiries: InquiryRow[];
  newInquiryCount: number;
  teams: TeamSummary[];
  runners: RunnerSummary[];
  totals: { runners: number; teams: number; inquiries: number };
};

export async function getAdminOverview(): Promise<AdminOverview> {
  const db = getDb();

  const inquiries = await db
    .select()
    .from(contactInquiries)
    .orderBy(desc(contactInquiries.createdAt));

  const teamRows = await db.select().from(teams).orderBy(desc(teams.createdAt));
  const runnerRows = await db.select().from(runners).orderBy(desc(runners.createdAt));

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
    teamId: r.teamId,
    createdAt: r.createdAt,
  }));

  return {
    inquiries,
    newInquiryCount: inquiries.filter((i) => i.status === "new").length,
    teams: teamSummaries,
    runners: runnerSummaries,
    totals: {
      runners: runnerRows.length,
      teams: teamRows.length,
      inquiries: inquiries.length,
    },
  };
}

export async function setInquiryStatus(id: string, status: "new" | "handled") {
  await getDb().update(contactInquiries).set({ status }).where(eq(contactInquiries.id, id));
}

export async function deleteInquiryById(id: string) {
  await getDb().delete(contactInquiries).where(eq(contactInquiries.id, id));
}

/**
 * Remove a runner and any magic links pointing at them. (magic_links has a
 * FK to runners, so those rows must go first.)
 */
export async function deleteRunnerCascade(runnerId: string) {
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx.delete(magicLinks).where(eq(magicLinks.runnerId, runnerId));
    await tx.delete(runners).where(eq(runners.id, runnerId));
  });
}

/**
 * Remove a team along with its runners and every magic link referencing the
 * team or those runners — ordered to satisfy the foreign keys.
 */
export async function deleteTeamCascade(teamId: string) {
  const db = getDb();
  await db.transaction(async (tx) => {
    const teamRunners = await tx
      .select({ id: runners.id })
      .from(runners)
      .where(eq(runners.teamId, teamId));
    const runnerIds = teamRunners.map((r) => r.id);

    await tx.delete(magicLinks).where(eq(magicLinks.teamId, teamId));
    if (runnerIds.length > 0) {
      await tx.delete(magicLinks).where(inArray(magicLinks.runnerId, runnerIds));
    }
    await tx.delete(runners).where(eq(runners.teamId, teamId));
    await tx.delete(teams).where(eq(teams.id, teamId));
  });
}
