import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { eventRegistrations } from "./event-registrations";
// Relative on purpose: drizzle-kit loads schema files outside the Next.js
// toolchain, where the `@/` alias may not resolve (same reason as `events.ts`).
import type { ConsentKind, DocSet, DocSlug } from "../../lib/legal/manifest";

/**
 * Consent as evidence (ADR 0006).
 *
 * Registration recorded acceptance as `event_registrations.terms`, a boolean
 * `createFreeRegistration` set to a hardcoded `true`. It could not say which
 * document, which version, which language, when, or from where. These two tables
 * replace it: written in the same transaction as the registration, so "a
 * registration without a consent record" stops being possible rather than merely
 * unlikely.
 *
 * **Why two tables and not one.** A single table with `unique(registration_id,
 * item_id)` cannot record a *second* acceptance of the same item after a document
 * is re-issued — which is the whole point of storing a version. The submission is
 * the form-filling event (one moment, one locale, one IP, one snapshot); the
 * consent rows are the individual boxes ticked inside it. Re-consent appends a
 * second submission with its own rows.
 *
 * **Rows are inserted, never updated.** The only column that is ever written
 * after the fact is {@link registrationConsents.withdrawnAt}, and only on a row
 * whose `kind` is `consent`: withdrawing a *declaration* ("I was 18 on race day")
 * is incoherent, and withdrawing an *acceptance* is called not entering.
 *
 * `kind` is `text` + `$type<ConsentKind>`, not a pgEnum — `ALTER TYPE … ADD
 * VALUE` cannot run inside a transaction and is the shape that stranded migration
 * 0012 on the live database.
 */

/**
 * The runner's details as they stood at the moment of acceptance — the fill
 * tokens of the personalised Statement (`__FULL_NAME__`, `__BIRTH_DATE__`,
 * `__PHONE_EMAIL__`, `__ADDRESS__`, `__EMERGENCY_CONTACT__`).
 *
 * Deliberate duplication of `users` data, and it is *supposed* to drift from it:
 * a Statement rendered from the live profile is a reconstruction, not a record —
 * correct a surname in October and the August document silently changes.
 *
 * `address` is optional to the runner and `emergencyContact` is required, but
 * both are typed as present-and-possibly-empty so a snapshot read back is a total
 * object; a blank string renders as a blank line via `fillLegalTokens`.
 */
export type ConsentSnapshot = {
  fullName: string;
  /** `YYYY-MM-DD`, or `""` when the profile carried no usable date. */
  birthDate: string;
  /** Phone and e-mail as one line, the way the Statement prints them. */
  phoneEmail: string;
  address: string;
  emergencyContact: string;
};

/** What a ticked box stores. `"true"` for anything that is not the image question. */
export type ConsentValue = "true" | "agree" | "disagree";

/** One consent form submission: one registration, one moment, one language. */
export const consentSubmissions = pgTable(
  "consent_submissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /**
     * A real FK with `on delete cascade`, unlike the six `event_slug`-keyed
     * tables (ADR 0005): a consent row is meaningless without its registration
     * and should die with it.
     */
    registrationId: uuid("registration_id")
      .notNull()
      .references(() => eventRegistrations.id, { onDelete: "cascade" }),
    docSet: text("doc_set").$type<DocSet>().notNull(),
    /** The language the documents were **actually shown in**, not a preference. */
    locale: text("locale").notNull(),
    snapshot: jsonb("snapshot").$type<ConsentSnapshot>().notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }).defaultNow().notNull(),
    /** Request IP, best effort — proxies may withhold it, hence nullable. */
    ip: text("ip"),
    userAgent: text("user_agent"),
  },
  (table) => [index("consent_submissions_registration_idx").on(table.registrationId)],
);

/** One ticked box, append-only. */
export const registrationConsents = pgTable(
  "registration_consents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => consentSubmissions.id, { onDelete: "cascade" }),
    /** A `ConsentItem.id` from the manifest — frozen once shipped. */
    itemId: text("item_id").notNull(),
    kind: text("kind").$type<ConsentKind>().notNull(),
    docSlug: text("doc_slug").$type<DocSlug>().notNull(),
    /** The document's declared version **at write time**, copied from the manifest. */
    docVersion: text("doc_version").notNull(),
    value: text("value").$type<ConsentValue>().notNull(),
    /** Only ever set when `kind = 'consent'` — see the module note. */
    withdrawnAt: timestamp("withdrawn_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("registration_consents_submission_item_uq").on(table.submissionId, table.itemId),
    /**
     * Partial on `kind = 'consent'` because the one query that scans by value is
     * "who refused image use before I publish this gallery" — a handful of rows
     * out of every registration's six.
     */
    index("registration_consents_consent_value_idx")
      .on(table.itemId, table.value)
      .where(sql`${table.kind} = 'consent'`),
  ],
);

export type ConsentSubmissionRow = typeof consentSubmissions.$inferSelect;
export type RegistrationConsentRow = typeof registrationConsents.$inferSelect;
