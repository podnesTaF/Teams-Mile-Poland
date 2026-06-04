import { pgTable, uuid, text, timestamp, pgEnum, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { runners } from "./runners";
import { broadcasts } from "./broadcasts";

// One row per email we attempt to send to a runner. Powers idempotency
// (don't send the same lifecycle email twice) and admin visibility.
export const emailKindEnum = pgEnum("email_kind", [
  "reminder_14d",
  "reminder_7d",
  "reminder_3d",
  "reminder_1d",
  "morning",
  "captain_incomplete",
  "broadcast",
]);

export const emailStatusEnum = pgEnum("email_status", ["sent", "failed"]);

export const emailLog = pgTable(
  "email_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runnerId: uuid("runner_id")
      .notNull()
      .references(() => runners.id),
    kind: emailKindEnum("kind").notNull(),
    broadcastId: uuid("broadcast_id").references(() => broadcasts.id),
    status: emailStatusEnum("status").notNull(),
    error: text("error"),
    sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    // Each lifecycle email sends at most once per runner.
    uniqueIndex("email_log_runner_kind_unique")
      .on(t.runnerId, t.kind)
      .where(sql`${t.kind} <> 'broadcast'`),
    // A given broadcast reaches each runner at most once.
    uniqueIndex("email_log_runner_broadcast_unique")
      .on(t.runnerId, t.broadcastId)
      .where(sql`${t.broadcastId} is not null`),
  ],
);
