import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";

import { eventHeats, eventRegistrations, users } from "@/db/schema";
import { getDb } from "@/lib/db";

export type EventRegistrationRow = typeof eventRegistrations.$inferSelect;

/** Whether a user already has a registration for an event. */
export async function hasRegistration(eventSlug: string, userId: string): Promise<boolean> {
  return Boolean(await getRegistration(eventSlug, userId));
}

/** A user's registration for an event, or null. */
export async function getRegistration(
  eventSlug: string,
  userId: string,
): Promise<EventRegistrationRow | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(eventRegistrations)
    .where(and(eq(eventRegistrations.eventSlug, eventSlug), eq(eventRegistrations.userId, userId)))
    .limit(1);
  return row ?? null;
}

/**
 * Create a free registration for a user. Registration is free and uncapped;
 * the unique (event_slug, user_id) index is the only guard against duplicates.
 */
export async function createFreeRegistration(input: {
  eventSlug: string;
  userId: string;
  locale: string;
}): Promise<EventRegistrationRow> {
  const db = getDb();
  const [row] = await db
    .insert(eventRegistrations)
    .values({
      eventSlug: input.eventSlug,
      userId: input.userId,
      status: "registered",
      terms: true,
      locale: input.locale,
    })
    .returning();
  return row;
}

/** A user's registrations, newest first (enrich with registry data in the UI). */
export async function getUserRegistrations(userId: string): Promise<EventRegistrationRow[]> {
  const db = getDb();
  return db
    .select()
    .from(eventRegistrations)
    .where(eq(eventRegistrations.userId, userId))
    .orderBy(desc(eventRegistrations.createdAt));
}

/** A runner's heat as the profile card and the ticket page display it. */
export type PublishedHeatView = { number: number; scheduledAt: Date };

/**
 * Published heats for the given registrations, keyed by registration id.
 *
 * **Published only.** A draft heat is admin work-in-progress that the runner has
 * not been emailed about, and showing it would contradict the mailing the moment
 * an admin rebalanced the card (PRD #26). One query for a whole list, so the
 * profile page does not fan out per registration.
 *
 * The returned `scheduledAt` is the stored instant; callers format it as Warsaw
 * wall-clock via `formatHeatTime` and label it approximate.
 */
export async function publishedHeatsByRegistration(
  registrationIds: string[],
): Promise<Map<string, PublishedHeatView>> {
  const ids = [...new Set(registrationIds)];
  if (ids.length === 0) return new Map();

  const rows = await getDb()
    .select({
      registrationId: eventRegistrations.id,
      number: eventHeats.number,
      scheduledAt: eventHeats.scheduledAt,
    })
    .from(eventRegistrations)
    .innerJoin(eventHeats, eq(eventRegistrations.heatId, eventHeats.id))
    .where(and(inArray(eventRegistrations.id, ids), isNotNull(eventHeats.publishedAt)));

  return new Map(rows.map((r) => [r.registrationId, { number: r.number, scheduledAt: r.scheduledAt }]));
}

/** Load one registration joined with its user, for ticket rendering. */
export async function loadEventRegistration(registrationId: string): Promise<
  | { registration: EventRegistrationRow; user: typeof users.$inferSelect }
  | null
> {
  const db = getDb();
  const [row] = await db
    .select({ registration: eventRegistrations, user: users })
    .from(eventRegistrations)
    .innerJoin(users, eq(eventRegistrations.userId, users.id))
    .where(eq(eventRegistrations.id, registrationId))
    .limit(1);
  return row ?? null;
}
