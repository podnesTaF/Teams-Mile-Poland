import { desc, eq, sql } from "drizzle-orm";

import { broadcasts, emailLog, runners } from "@/db/schema";
import { getDb } from "@/lib/db";
import type { LifecycleKind } from "@/emails/lifecycle/copy";

import { captainNudgeDue, scheduleRows } from "./schedule";
import { incompleteCaptains } from "./audience";

export const KIND_LABEL: Record<LifecycleKind, string> = {
  reminder_14d: "−14 days · light reminder",
  reminder_7d: "−7 days · logistics",
  reminder_3d: "−3 days · checklist",
  reminder_1d: "−1 day · practical",
  morning: "Morning of · go!",
  captain_incomplete: "Captain reminder · incomplete teams",
};

export type MailingRow = {
  kind: LifecycleKind;
  label: string;
  sendAt: Date | null;
  status: "done" | "due" | "upcoming";
  eligible: number;
  sent: number;
};

export type BroadcastRow = typeof broadcasts.$inferSelect;

async function sentCountByKind(): Promise<Map<string, number>> {
  const rows = await getDb()
    .select({ kind: emailLog.kind, value: sql<number>`count(*)::int` })
    .from(emailLog)
    .where(eq(emailLog.status, "sent"))
    .groupBy(emailLog.kind);
  return new Map(rows.map((r) => [r.kind, r.value]));
}

export async function getMailingsOverview(now: Date): Promise<{
  rows: MailingRow[];
  past: BroadcastRow[];
  totalRunners: number;
}> {
  const db = getDb();
  const [{ value: totalRunners }] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(runners);
  const sent = await sentCountByKind();
  const incomplete = (await incompleteCaptains()).length;

  const rows: MailingRow[] = scheduleRows(now).map((r) => ({
    kind: r.kind,
    label: KIND_LABEL[r.kind],
    sendAt: r.sendAt,
    status: r.status,
    eligible: totalRunners,
    sent: sent.get(r.kind) ?? 0,
  }));

  rows.push({
    kind: "captain_incomplete",
    label: KIND_LABEL.captain_incomplete,
    sendAt: null,
    status: captainNudgeDue(now) ? "due" : "upcoming",
    eligible: incomplete,
    sent: sent.get("captain_incomplete") ?? 0,
  });

  const past = await db.select().from(broadcasts).orderBy(desc(broadcasts.createdAt)).limit(20);

  return { rows, past, totalRunners };
}
