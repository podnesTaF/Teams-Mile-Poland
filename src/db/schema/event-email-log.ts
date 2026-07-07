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
