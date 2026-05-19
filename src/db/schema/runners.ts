import { pgTable, uuid, text, date, integer, boolean, timestamp, pgEnum, jsonb } from "drizzle-orm/pg-core";
import { teams } from "./teams";

export const registrationTypeEnum = pgEnum("registration_type", [
  "captain", "team_member", "free_agent", "solo",
]);
export const assignmentStatusEnum = pgEnum("assignment_status", [
  "assigned", "pending_assignment", "n/a",
]);
export const genderEnum = pgEnum("gender", ["male", "female"]);
export const paymentStatusEnum = pgEnum("payment_status", [
  "free", "paid", "pending", "refunded",
]);

export const runners = pgTable("runners", {
  id: uuid("id").defaultRandom().primaryKey(),
  teamId: uuid("team_id").references(() => teams.id),
  registrationType: registrationTypeEnum("registration_type").notNull(),
  assignmentStatus: assignmentStatusEnum("assignment_status").default("n/a").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  dob: date("dob").notNull(),
  gender: genderEnum("gender").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  nationality: text("nationality").notNull(),
  club: text("club"),
  coach: text("coach"),
  personalBestSeconds: integer("personal_best_seconds"),
  ageCategory: text("age_category").notNull(),
  preferredRegion: text("preferred_region"),
  preferredTeammates: text("preferred_teammates"),
  freeSlot: boolean("free_slot").default(false).notNull(),
  paymentStatus: paymentStatusEnum("payment_status").default("pending").notNull(),
  stripeSessionId: text("stripe_session_id"),
  consents: jsonb("consents").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
