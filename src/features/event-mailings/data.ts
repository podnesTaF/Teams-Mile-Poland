import { eq, sql } from "drizzle-orm";

import { eventEmailLog, eventRegistrations } from "@/db/schema";
import { getDb } from "@/lib/db";
import { getSeriesEvents } from "@/lib/events/registry";

import { eligibleForEvent } from "./audience";
import {
  scheduleRowsForEvent,
  type EventScheduledKind,
} from "./schedule";

export const EVENT_KIND_LABEL: Record<EventScheduledKind, string> = {
  reminder_7d: "−7 days · logistics (+ confirm ask)",
  reminder_3d: "−3 days · checklist (+ confirm ask)",
  reminder_1d: "−1 day · practical (+ confirm ask)",
  morning: "Morning of · go!",
};

export type EventMailingRow = {
  eventSlug: string;
  eventLabel: string;
  kind: EventScheduledKind;
  label: string;
  sendAt: Date;
  status: "done" | "due" | "upcoming";
  eligible: number;
  /** Still `registered` — the confirm CTA audience inside reminder kinds. */
  awaitingConfirmation: number;
  sent: number;
};

export type EventMailingsGroup = {
  eventSlug: string;
  eventLabel: string;
  eventDate: string;
  eligible: number;
  awaitingConfirmation: number;
  rows: EventMailingRow[];
};

/** Sent counts keyed by `${eventSlug}:${kind}` for series events. */
async function sentCountByEventAndKind(): Promise<Map<string, number>> {
  const rows = await getDb()
    .select({
      eventSlug: eventRegistrations.eventSlug,
      kind: eventEmailLog.kind,
      value: sql<number>`count(*)::int`,
    })
    .from(eventEmailLog)
    .innerJoin(
      eventRegistrations,
      eq(eventEmailLog.eventRegistrationId, eventRegistrations.id),
    )
    .where(eq(eventEmailLog.status, "sent"))
    .groupBy(eventRegistrations.eventSlug, eventEmailLog.kind);
  return new Map(rows.map((r) => [`${r.eventSlug}:${r.kind}`, r.value]));
}

/**
 * Per-event lifecycle overview for the admin mailings page. One group per
 * non-completed series event — schedules, eligible counts, and how many are
 * still awaiting confirmation (the confirm-ask audience).
 */
export async function getEventMailingsOverview(now: Date): Promise<EventMailingsGroup[]> {
  const sent = await sentCountByEventAndKind();
  const groups: EventMailingsGroup[] = [];

  for (const event of getSeriesEvents()) {
    const recipients = await eligibleForEvent(event.slug);
    const awaitingConfirmation = recipients.filter((r) => r.status === "registered").length;
    const eligible = recipients.length;
    const rows: EventMailingRow[] = scheduleRowsForEvent(now, event).map((r) => ({
      eventSlug: event.slug,
      eventLabel: event.shortDate,
      kind: r.kind,
      label: EVENT_KIND_LABEL[r.kind],
      sendAt: r.sendAt,
      status: r.status,
      eligible,
      awaitingConfirmation,
      sent: sent.get(`${event.slug}:${r.kind}`) ?? 0,
    }));
    groups.push({
      eventSlug: event.slug,
      eventLabel: event.shortDate,
      eventDate: event.date,
      eligible,
      awaitingConfirmation,
      rows,
    });
  }

  return groups;
}
