import { and, eq, inArray, isNotNull } from "drizzle-orm";

import { eventHeats, eventRegistrations } from "@/db/schema";
import { getDb } from "@/lib/db";
import { sendAt } from "@/features/event-mailings/schedule";
import type { EventSummary } from "@/lib/events/types";

import type { EventRegistrationRow } from "./data";

/**
 * Attendance confirmation — the runner's remote, pre-race "I am coming"
 * (PRD #26, slice #28). Distinct from check-in, which is the admin's on-site
 * verification of arrival.
 *
 * The confirmation *window* is a display concern only: it opens when the first
 * reminder goes out (7 days before the event) and closes once the heat card is
 * published, because from then on the seeding decision has already been made
 * and emailed. Closing it is deliberately **not** a lockout — the action itself
 * still accepts a late confirm (see {@link confirmRegistration}), and a runner
 * who never confirmed is handled by the day-of walk-up path.
 */

/**
 * The instant the confirm CTA starts appearing: the 7-day reminder send time,
 * so the ask on the site and the ask in the inbox arrive together rather than
 * drifting apart if the schedule is retuned.
 */
export function confirmationOpensAt(event: EventSummary): Date {
  return sendAt("reminder_7d", event);
}

/**
 * Whether the confirm CTA should be offered for an event right now. Callers
 * additionally require the registration to still be `registered`.
 */
export function isConfirmationOpen(input: {
  event: EventSummary | undefined;
  now: Date;
  heatsPublished: boolean;
}): boolean {
  const { event, now, heatsPublished } = input;
  if (!event || event.eventType !== "individual") return false;
  if (event.status === "completed") return false;
  if (heatsPublished) return false;
  return now.getTime() >= confirmationOpensAt(event).getTime();
}

/**
 * Which of the given event slugs already have at least one published heat.
 * One query for the whole profile page rather than one per registration.
 */
export async function slugsWithPublishedHeats(slugs: string[]): Promise<Set<string>> {
  const unique = [...new Set(slugs)];
  if (unique.length === 0) return new Set();

  const rows = await getDb()
    .selectDistinct({ eventSlug: eventHeats.eventSlug })
    .from(eventHeats)
    .where(and(inArray(eventHeats.eventSlug, unique), isNotNull(eventHeats.publishedAt)));

  return new Set(rows.map((r) => r.eventSlug));
}

export type ConfirmOutcome =
  /** Was `registered`, is now `confirmed`. */
  | "confirmed"
  /** Already confirmed (or further along) — a no-op, reported as success. */
  | "already"
  /** No such registration. */
  | "notfound"
  /** Marked a no-show; confirming would contradict a recorded fact. */
  | "ineligible";

/**
 * Flip a registration `registered → confirmed` and stamp `confirmedAt`.
 *
 * Idempotent by construction: the status predicate lives in the UPDATE, so two
 * concurrent confirms cannot both write and the second reports `already`. The
 * original `confirmedAt` is never overwritten — it is the runner's answer, and
 * re-answering the same question does not move the timestamp.
 *
 * Deliberately does **not** enforce the confirmation window: a late confirm is
 * harmless and useful (the admin sees a headcount), while rejecting it would
 * turn a soft signal into a lockout.
 */
export async function confirmRegistration(registrationId: string): Promise<ConfirmOutcome> {
  const db = getDb();

  const updated = await db
    .update(eventRegistrations)
    .set({ status: "confirmed", confirmedAt: new Date() })
    .where(
      and(eq(eventRegistrations.id, registrationId), eq(eventRegistrations.status, "registered")),
    )
    .returning({ id: eventRegistrations.id });

  if (updated.length > 0) return "confirmed";

  const [row] = await db
    .select({ status: eventRegistrations.status })
    .from(eventRegistrations)
    .where(eq(eventRegistrations.id, registrationId))
    .limit(1);

  if (!row) return "notfound";
  return row.status === "no_show" ? "ineligible" : "already";
}

/** Whether a registration still owes an answer — drives every confirm CTA. */
export function awaitingConfirmation(
  registration: Pick<EventRegistrationRow, "status">,
): boolean {
  return registration.status === "registered";
}
