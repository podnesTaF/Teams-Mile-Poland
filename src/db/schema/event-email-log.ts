import { pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { emailStatusEnum } from "./email-log";
import { eventRegistrations } from "./event-registrations";

/**
 * Lifecycle-email idempotency for individual-event participants — the
 * event-keyed sibling of `email_log` (which is FK'd to legacy `runners`).
 * One row per (registration, kind); the unique index makes each lifecycle
 * email send at most once per registration. Separate enum so the event chain
 * can evolve independently of the legacy one (no captain nudge, no 14d).
 */
export const eventEmailKindEnum = pgEnum("event_email_kind", [
  "reminder_7d",
  "reminder_3d",
  "reminder_1d",
  "morning",
  "confirmation",
  // Manual, admin-triggered "your gallery is live" mailing (PRD #14, slice #18).
  // Not part of the scheduled chain — dispatched from the admin event page, one
  // per event, idempotent per (event_registration_id, 'media_live').
  "media_live",
  // "Your heat is <n> at ~<time>" — dispatched by `publishHeats` (PRD #26,
  // slice #30), not the scheduled chain. Deliberately **one** kind for both the
  // first notice and a later change: re-notification is gated on the
  // `notified_heat_id` / `notified_heat_time` delta, not on this log, so the
  // (registration, kind) row here records only that the runner has been told
  // about their heat at least once.
  "heat_assignment",
]);

export const eventEmailLog = pgTable(
  "event_email_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventRegistrationId: uuid("event_registration_id")
      .notNull()
      .references(() => eventRegistrations.id, { onDelete: "cascade" }),
    kind: eventEmailKindEnum("kind").notNull(),
    status: emailStatusEnum("status").notNull(),
    error: text("error"),
    sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("event_email_log_registration_kind_unique").on(t.eventRegistrationId, t.kind),
  ],
);
