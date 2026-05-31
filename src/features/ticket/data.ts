import { eq } from "drizzle-orm";

import { runners, teams } from "@/db/schema";
import { getDb } from "@/lib/db";

import type { TicketView } from "./types";
import { EVENT } from "@/lib/marketing/event";

export type LoadedTicket = {
  view: TicketView;
  checkedInAt: Date | null;
};

export async function loadTicketByRunnerId(runnerId: string): Promise<LoadedTicket | null> {
  const db = getDb();

  const [row] = await db
    .select({ runner: runners, team: teams })
    .from(runners)
    .leftJoin(teams, eq(runners.teamId, teams.id))
    .where(eq(runners.id, runnerId))
    .limit(1);

  if (!row) return null;

  const { runner, team } = row;
  const flow =
    runner.registrationType === "captain"
      ? "start"
      : runner.registrationType === "team_member"
        ? "join"
        : "free";

  const paymentStatus = runner.paymentStatus === "paid" ? "paid" : "free";

  return {
    checkedInAt: runner.checkedInAt ?? null,
    view: {
      runnerId: runner.id,
      fullName: runner.fullName,
      email: runner.email,
      phone: runner.phone,
      teamCode: team?.code,
      teamName: team?.name,
      flow,
      paymentStatus,
      eventName: EVENT.name,
      eventDateLabel: EVENT.dateLabel.en,
      eventVenue: `${EVENT.venue.name}, ${EVENT.venue.city}`,
      checkedInAt: runner.checkedInAt ?? null,
    },
  };
}

export async function markCheckedIn(runnerId: string): Promise<Date | null> {
  const db = getDb();
  const now = new Date();
  const [updated] = await db
    .update(runners)
    .set({ checkedInAt: now })
    .where(eq(runners.id, runnerId))
    .returning({ checkedInAt: runners.checkedInAt });
  return updated?.checkedInAt ?? null;
}
