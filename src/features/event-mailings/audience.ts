import { and, eq, inArray } from "drizzle-orm";

import { eventRegistrations, users, type ParticipationStatus } from "@/db/schema";
import { placementTeamsById, type PlacementTeam } from "@/features/teams/placement";
import { getDb } from "@/lib/db";

import { asMailLocale, type MailLocale } from "./copy";

export type EventRecipient = {
  registrationId: string;
  email: string;
  fullName: string;
  locale: MailLocale;
  /** Drives the conditional confirmation ask in the reminder templates. */
  status: ParticipationStatus;
  /**
   * The placement team a `team` registration runs for ("RED" / "BLACK"), or
   * `null` for the individual mile (ADR 0016) — the reminders name the team.
   */
  teamLabel: PlacementTeam["label"] | null;
};

/**
 * Active participants for an event's lifecycle emails: registrations that are
 * still on (registered, confirmed, or already checked in). Cancelled / no-show
 * are skipped.
 */
export async function eligibleForEvent(eventSlug: string): Promise<EventRecipient[]> {
  const db = getDb();
  const rows = await db
    .select({
      registrationId: eventRegistrations.id,
      email: users.email,
      name: users.name,
      firstName: users.firstName,
      lastName: users.lastName,
      locale: eventRegistrations.locale,
      status: eventRegistrations.status,
      raceFormat: eventRegistrations.raceFormat,
      teamId: eventRegistrations.teamId,
    })
    .from(eventRegistrations)
    .innerJoin(users, eq(eventRegistrations.userId, users.id))
    .where(
      and(
        eq(eventRegistrations.eventSlug, eventSlug),
        inArray(eventRegistrations.status, ["registered", "confirmed", "checked_in"]),
      ),
    );

  // One read for every team in the list; an individual-only night asks nothing.
  const teams = await placementTeamsById(
    rows.filter((r) => r.raceFormat === "team").map((r) => r.teamId),
  );

  return rows.map((r) => ({
    registrationId: r.registrationId,
    email: r.email,
    fullName: [r.firstName, r.lastName].filter(Boolean).join(" ").trim() || r.name || r.email,
    locale: asMailLocale(r.locale),
    status: r.status as ParticipationStatus,
    teamLabel:
      r.raceFormat === "team" && r.teamId ? (teams.get(r.teamId)?.label ?? null) : null,
  }));
}
