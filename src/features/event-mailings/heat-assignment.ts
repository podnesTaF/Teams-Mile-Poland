import { and, asc, eq, inArray } from "drizzle-orm";

import { eventEmailLog, eventHeats, eventRegistrations, users } from "@/db/schema";
import { EventHeatAssignmentEmail } from "@/emails/event-heat-assignment";
import { heatNotifyState, publishEventHeats } from "@/features/admin/heats-data";
import { makeEventTicketUrl } from "@/features/event-registration/ticket";
import { getDb } from "@/lib/db";
import { FROM_EMAIL, resend } from "@/lib/email";
import { formatHeatTime } from "@/lib/events/heat-time";
import { getEventBySlug } from "@/lib/events/registry";

import { asMailLocale, heatAssignmentSubject, type MailLocale } from "./copy";

/** Dispatched by `publishHeats`, never by the cron window. */
const HEAT_ASSIGNMENT_KIND = "heat_assignment" as const;

export type PublishHeatsSummary = {
  eventSlug: string;
  /** Heats stamped `publishedAt` by this press (0 on a re-publish). */
  published: number;
  /** Active registrations currently sitting in a heat. */
  seeded: number;
  notified: number;
  skipped: number;
  failed: number;
};

/** Thrown when the slug is not an individual event in the registry. */
export class HeatPublishNotEligibleError extends Error {}

/**
 * One seeded runner as the publish delta sees them: where they are now, and
 * what they were last told.
 */
type SeededRunner = {
  registrationId: string;
  email: string;
  fullName: string;
  locale: MailLocale;
  heatId: string;
  heatNumber: number;
  scheduledAt: Date;
  notifiedHeatId: string | null;
  notifiedHeatTime: Date | null;
};

/**
 * Everyone seeded into one of the event's heats who is still coming.
 *
 * `no_show` is excluded but `checked_in` is not: a runner already at the desk on
 * race morning can still have their heat moved, and they should hear about it.
 */
async function seededRunners(eventSlug: string): Promise<SeededRunner[]> {
  const db = getDb();
  const rows = await db
    .select({
      registrationId: eventRegistrations.id,
      email: users.email,
      name: users.name,
      firstName: users.firstName,
      lastName: users.lastName,
      locale: eventRegistrations.locale,
      heatId: eventHeats.id,
      heatNumber: eventHeats.number,
      scheduledAt: eventHeats.scheduledAt,
      notifiedHeatId: eventRegistrations.notifiedHeatId,
      notifiedHeatTime: eventRegistrations.notifiedHeatTime,
    })
    .from(eventRegistrations)
    .innerJoin(users, eq(eventRegistrations.userId, users.id))
    // Inner join on the heat: an unseeded registration has nothing to be told.
    .innerJoin(eventHeats, eq(eventRegistrations.heatId, eventHeats.id))
    .where(
      and(
        eq(eventRegistrations.eventSlug, eventSlug),
        inArray(eventRegistrations.status, ["registered", "confirmed", "checked_in"]),
      ),
    )
    .orderBy(asc(eventHeats.number), asc(users.lastName));

  return rows.map((r) => ({
    registrationId: r.registrationId,
    email: r.email,
    fullName: [r.firstName, r.lastName].filter(Boolean).join(" ").trim() || r.name || r.email,
    locale: asMailLocale(r.locale),
    heatId: r.heatId,
    heatNumber: r.heatNumber,
    scheduledAt: r.scheduledAt,
    notifiedHeatId: r.notifiedHeatId,
    notifiedHeatTime: r.notifiedHeatTime,
  }));
}

/**
 * Publish an event's heats and notify the runners it affects (PRD #26, slice
 * #30). The contract's `publishHeats` — one action per event, idempotent and
 * re-pressable:
 *
 * - every unpublished heat is stamped `publishedAt`;
 * - a runner is emailed only if their heat or start time differs from
 *   `notifiedHeatId` / `notifiedHeatTime`, or they were never notified;
 * - those two columns are updated **after** a successful send, so a failed send
 *   is retried by the next press rather than silently swallowed.
 *
 * The `event_email_log` row (unique per registration + kind) records that the
 * runner has been told about their heat at least once; it is deliberately *not*
 * the re-notify gate, since a change has to be able to mail the same person
 * again. Callers enforce the admin gate — see `heat-actions.ts`.
 */
export async function publishHeatsAndNotify(eventSlug: string): Promise<PublishHeatsSummary> {
  const event = getEventBySlug(eventSlug);
  if (!event || event.eventType !== "individual") {
    throw new HeatPublishNotEligibleError("This slug isn't an individual event.");
  }

  const published = await publishEventHeats(eventSlug);
  const runners = await seededRunners(eventSlug);
  const summary: PublishHeatsSummary = {
    eventSlug,
    published,
    seeded: runners.length,
    notified: 0,
    skipped: 0,
    failed: 0,
  };

  // Everything that is not already holding a current notice: never-notified
  // (including walk-ups seeded after the first press) and moved-since.
  const due = runners.filter((r) => heatNotifyState(r) !== "notified");
  summary.skipped = runners.length - due.length;

  // No mail transport configured (local dev): the card is still published, but
  // nothing is stamped as notified, so a real press later mails everyone.
  if (!resend) {
    summary.skipped += due.length;
    return summary;
  }

  const db = getDb();

  for (const r of due) {
    const changed = r.notifiedHeatId !== null;
    const startTime = formatHeatTime(r.scheduledAt);
    try {
      // Resend reports API failures in `error` rather than throwing, so an
      // unchecked call would stamp `notified*` for mail that never left — and
      // re-publishing would then skip that runner forever. Turn it into a throw
      // so the one catch below governs both transport and API failures.
      const { error } = await resend.emails.send({
        from: FROM_EMAIL,
        to: r.email,
        subject: heatAssignmentSubject(r.locale, {
          heatNumber: r.heatNumber,
          startTime,
          changed,
        }),
        react: EventHeatAssignmentEmail({
          locale: r.locale,
          fullName: r.fullName,
          eventName: event.name,
          heatNumber: r.heatNumber,
          startTime,
          ticketUrl: makeEventTicketUrl(r.registrationId, { locale: r.locale }),
          changed,
        }),
      });
      if (error) throw new Error(error.message);

      await db
        .update(eventRegistrations)
        .set({ notifiedHeatId: r.heatId, notifiedHeatTime: r.scheduledAt })
        .where(eq(eventRegistrations.id, r.registrationId));

      await db
        .insert(eventEmailLog)
        .values({
          eventRegistrationId: r.registrationId,
          kind: HEAT_ASSIGNMENT_KIND,
          status: "sent",
        })
        .onConflictDoNothing();

      summary.notified += 1;
    } catch {
      summary.failed += 1;
    }
  }

  return summary;
}
