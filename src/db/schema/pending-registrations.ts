import { pgTable, uuid, text, jsonb, timestamp } from "drizzle-orm/pg-core";

// Holds form payload during Stripe checkout. TTL via cleanup job.
export const pendingRegistrations = pgTable("pending_registrations", {
  id: uuid("id").defaultRandom().primaryKey(),
  payload: jsonb("payload").notNull(),
  stripeSessionId: text("stripe_session_id").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
