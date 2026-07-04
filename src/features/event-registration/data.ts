import { and, desc, eq } from "drizzle-orm";

import { eventRegistrations, users } from "@/db/schema";
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
