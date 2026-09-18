import { sql } from "drizzle-orm";
import { boolean, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { users } from "./auth";
import { eventHeats } from "./event-heats";
// Circular by construction — `team_entry_members.registration_id` points back
// here — and safe because every Drizzle `references()` is a lazy callback that
// runs long after both modules have finished loading.
import { teamEntries } from "./team-entries";

/**
 * Participation lifecycle for individual events. Live model:
 * `registered → confirmed → checked_in → no_show`. `confirmed` is the runner's
 * own remote "I am coming" (see `confirmedAt`); `checked_in` is the admin's
 * on-site verification of arrival. `cancelled` is **deprecated in code**
 * (never set — see {@link ParticipationStatus}); the physical enum value is
 * retained here because dropping it is not an additive migration.
 */
export const participationStatusEnum = pgEnum("participation_status", [
  "registered",
  "confirmed",
  "checked_in",
  "no_show",
  "cancelled",
]);

/**
 * The live participation statuses code may set or read. Excludes the deprecated
 * `cancelled` physical enum value so it can never leak into the TS surface.
 */
export type ParticipationStatus = Exclude<
  (typeof participationStatusEnum.enumValues)[number],
  "cancelled"
>;

/**
 * One row per (event, user). Keyed by `event_slug` text (no FK — events are rows
 * now, but the slug remains the stable join key for six tables, and an event
 * with registrations is never hard-deleted: the admin guard refuses and offers
 * `cancelled` instead, which is a better failure than a cascade. See ADR 0005).
 * A registration is free unless the night is priced: from ADR 0013 an event row
 * may carry `individual_entry_fee_acer`, and on such a night the registration is
 * written in the same transaction as the ACER debit that paid for it
 * (`createRegistrationWithConsent`). There is deliberately **no payment column
 * here** — the payment is a ledger row keyed `entry_fee:<registrationId>`, which
 * is what ADR 0001 left open and what keeps money in one place rather than
 * half-here and half-there. The admin comp path (`createFreeRegistration`) is
 * free on a priced night too.
 *
 * A bib is a **lease**, not an identity (ADR 0003): it is issued at check-in and
 * returned when the runner's heat is marked finished, which stamps
 * `bibReturnedAt`. The partial unique index therefore encodes "held by at most
 * one runner at a time" rather than "one bib per registration for the event".
 * The `bib` value itself is retained after return so historical results stay
 * accurate.
 */
export const eventRegistrations = pgTable(
  "event_registrations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventSlug: text("event_slug").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: participationStatusEnum("status").default("registered").notNull(),
    bib: integer("bib"),
    /** Set while the runner holds the bib lease; stamped when it returns to the pool. */
    bibReturnedAt: timestamp("bib_returned_at", { withTimezone: true }),
    /**
     * @deprecated Superseded by `consent_submissions` / `registration_consents`
     * (ADR 0006). It was written as a hardcoded `true` and so records nothing:
     * not which document, which version, which language, when, or from where.
     * Retained — not dropped — because the 197 registrations that predate the
     * consent tables have no other trace of acceptance, and no rows are
     * backfilled for them. It is no longer written as a literal: the consent
     * path derives it from the set's `acceptance`-kind items, and paths that
     * capture no consent (an admin registering a runner by hand) leave it
     * `false`. Read the consent rows, never this column.
     */
    terms: boolean("terms").default(false).notNull(),
    locale: text("locale").default("pl").notNull(),
    /** The heat the runner is seeded into; cleared if the heat is deleted. */
    heatId: uuid("heat_id").references(() => eventHeats.id, { onDelete: "set null" }),
    /** When the runner confirmed they are coming (remote, pre-race). */
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    /** Heat / start time the runner was last emailed — drives the publish delta. */
    notifiedHeatId: uuid("notified_heat_id"),
    notifiedHeatTime: timestamp("notified_heat_time", { withTimezone: true }),
    checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
    /**
     * The team entry this registration was created by (PRD #64). `null` for
     * every individually-registered row, which is all of them until a manager
     * enters a team — the individual path never writes this column.
     *
     * `set null` rather than cascade, because it is only a back-link: it must
     * never be the reason a registration disappears. (Withdrawal deletes the
     * registrations *explicitly*, in the same transaction as the entry.)
     */
    teamEntryId: uuid("team_entry_id").references(() => teamEntries.id, {
      onDelete: "set null",
    }),
    /**
     * True between team entry and the member's own confirmation: the
     * registration exists, its consent evidence does not yet (PRD #64,
     * "Consent is pending, not absent").
     *
     * A flag rather than a new `participation_status` value on purpose — the
     * participation enum is deprecated territory (see above) and this state is
     * transient. `confirmed member` is defined as exactly `consent_pending =
     * false`, and no consent row is ever written on a member's behalf, so this
     * is the one column team check-in tests before admitting a runner.
     *
     * Defaults to `false`, which is what keeps the individual path untouched:
     * `registerForEvent` writes consent and registration together and never
     * mentions this column.
     */
    consentPending: boolean("consent_pending").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("event_registrations_event_user_uq").on(table.eventSlug, table.userId),
    uniqueIndex("event_registrations_event_bib_held_uq")
      .on(table.eventSlug, table.bib)
      .where(sql`${table.bib} is not null and ${table.bibReturnedAt} is null`),
  ],
);
