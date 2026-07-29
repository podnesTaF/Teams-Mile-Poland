import { and, eq, inArray } from "drizzle-orm";

import { eventRegistrations, users, type ParticipationStatus } from "@/db/schema";
import { getDb } from "@/lib/db";

import { asMailLocale, type MailLocale } from "./copy";

export type EventRecipient = {
  registrationId: string;
  email: string;
  fullName: string;
  locale: MailLocale;
  /** Drives the conditional confirmation ask in the reminder templates. */
  status: ParticipationStatus;
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
    })
    .from(eventRegistrations)
    .innerJoin(users, eq(eventRegistrations.userId, users.id))
    .where(
      and(
        eq(eventRegistrations.eventSlug, eventSlug),
        inArray(eventRegistrations.status, ["registered", "confirmed", "checked_in"]),
      ),
    );

  return rows.map((r) => ({
    registrationId: r.registrationId,
    email: r.email,
    fullName: [r.firstName, r.lastName].filter(Boolean).join(" ").trim() || r.name || r.email,
    locale: asMailLocale(r.locale),
    status: r.status as ParticipationStatus,
  }));
}
