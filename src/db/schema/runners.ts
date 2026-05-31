import { pgTable, uuid, text, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { teams } from "./teams";

// "solo" is kept in the enum to avoid a Postgres enum-alter step;
// it is no longer used by application code (solo flow retired).
export const registrationTypeEnum = pgEnum("registration_type", [
  "captain", "team_member", "free_agent", "solo",
]);
export const assignmentStatusEnum = pgEnum("assignment_status", [
  "assigned", "pending_assignment", "n/a",
]);
export const paymentStatusEnum = pgEnum("payment_status", [
  "free", "paid", "pending", "refunded",
]);

export const runners = pgTable("runners", {
  id: uuid("id").defaultRandom().primaryKey(),
  teamId: uuid("team_id").references(() => teams.id),
  registrationType: registrationTypeEnum("registration_type").notNull(),
  assignmentStatus: assignmentStatusEnum("assignment_status").default("n/a").notNull(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  terms: boolean("terms").default(false).notNull(),
  freeSlot: boolean("free_slot").default(false).notNull(),
  paymentStatus: paymentStatusEnum("payment_status").default("pending").notNull(),
  stripeSessionId: text("stripe_session_id"),
  checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
