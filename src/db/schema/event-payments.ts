import { sql } from "drizzle-orm";
import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { users } from "./auth";
import { userTeams } from "./user-teams";

/**
 * A paid entry fee for an event, one row per Stripe Checkout Session.
 *
 * An event with a price (`events.individual_price_pln` / `team_price_pln`)
 * does not write its registration or team entry when the runner or manager
 * presses the button. It writes one of these rows, sends them to Stripe, and the
 * webhook writes the registration (or entry) once the money has settled. The
 * row is the handoff between the two: what was asked for, what it cost, and
 * what it became.
 *
 * - `individual`: `payload` holds the validated consent submission, so the
 *   webhook can write the registration and its consent evidence in one
 *   transaction exactly as the free path does (ADR 0006).
 * - `team`: `teamId` names the team; the webhook re-checks the roster and
 *   enters it the same way `enterTeam` does for a free night.
 *
 * `status` and `kind` are `text` + `$type<>`, not pg enums, for the reason given
 * on `events.status`.
 *
 * - `pending`: the session is open at Stripe.
 * - `processing`: the webhook has claimed it (a conditional update, which is
 *   what makes a redelivered webhook a no-op).
 * - `fulfilled`: the registration / entry exists (`registrationId` /
 *   `teamEntryId`).
 * - `failed`: paid, but the registration or entry could not be written
 *   (`failureReason` says why). Needs a manual refund from the Stripe dashboard.
 * - `expired`: the payer left Stripe without paying.
 */
export type EventPaymentKind = "individual" | "team";
export type EventPaymentStatus = "pending" | "processing" | "fulfilled" | "failed" | "expired";

export const eventPayments = pgTable(
  "event_payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    kind: text("kind").$type<EventPaymentKind>().notNull(),
    eventSlug: text("event_slug").notNull(),
    /** Who pays: the runner, or the manager entering the team. */
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** The team being entered. Null for `individual`. */
    teamId: uuid("team_id").references(() => userTeams.id, { onDelete: "set null" }),
    /** Grosze. What Stripe was asked to charge. */
    amountMinor: integer("amount_minor").notNull(),
    currency: text("currency").default("pln").notNull(),
    stripeSessionId: text("stripe_session_id").notNull(),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    status: text("status").$type<EventPaymentStatus>().default("pending").notNull(),
    /** `individual`: the registration input, validated before checkout. */
    payload: jsonb("payload"),
    registrationId: uuid("registration_id"),
    teamEntryId: uuid("team_entry_id"),
    failureReason: text("failure_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("event_payments_session_uq").on(table.stripeSessionId),
    index("event_payments_event_user_idx").on(table.eventSlug, table.userId),
    index("event_payments_event_team_idx")
      .on(table.eventSlug, table.teamId)
      .where(sql`${table.teamId} is not null`),
  ],
);

export type EventPaymentRow = typeof eventPayments.$inferSelect;
