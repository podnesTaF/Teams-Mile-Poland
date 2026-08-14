import {
  boolean,
  date,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

/**
 * Better Auth tables — hand-written so drizzle-kit stays the only migration
 * tool (no `better-auth migrate`). Shapes mirror the canonical output of
 * `npx @better-auth/cli generate`; re-verify against it after any Better Auth
 * upgrade or config change (new plugins/additionalFields add columns).
 *
 * IDs are `text` because Better Auth generates its own string IDs on create
 * (not DB-side uuids). The adapter is wired with a schema map keyed by the
 * singular model names it expects — see `src/lib/auth/better-auth.ts`.
 */

/** Profile sex — an individual-event profile field (heat/category grouping). */
export const userSexEnum = pgEnum("user_sex", ["M", "F"]);

/**
 * Account role. `admin` is the only thing that opens `/admin` — there is no
 * shared admin password any more. Declared as a Better Auth additionalField
 * with `input: false` so it rides along on the session user but can never be
 * set by a client payload (sign-up, update-user); it moves only through
 * `src/features/admin/admins-actions.ts` or `scripts/grant-admin.ts`.
 *
 * Plain `text` rather than a pgEnum on purpose: enum values can only be added
 * by `ALTER TYPE`, which is exactly the migration shape that stranded 0012 on
 * the live DB. A role set is a value, not a type.
 */
export type UserRole = "user" | "admin";

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    image: text("image"),
    role: text("role").$type<UserRole>().default("user").notNull(),
    // --- profile additionalFields (see better-auth config user.additionalFields)
    firstName: text("first_name"),
    lastName: text("last_name"),
    // SQL DATE (calendar day, no tz) but mode:"date" so the Better Auth adapter
    // can pass/receive JS Date objects (additionalField type "date").
    dateOfBirth: date("date_of_birth", { mode: "date" }),
    sex: userSexEnum("sex"),
    club: text("club"),
    phone: text("phone"),
    locale: text("locale").default("pl").notNull(),
    // Marketing consent flag set by the public signed unsubscribe link; the
    // broadcast segment resolver excludes opted-out users centrally.
    // Transactional email (tickets, verification) ignores it. Not a Better Auth
    // additionalField — written by direct DB update, never through the auth API.
    marketingOptOut: boolean("marketing_opt_out").default(false).notNull(),
    // --- referral program (stats-only). Neither is a Better Auth
    // additionalField: the code is generated lazily by getOrCreateReferralCode
    // and attribution is written once by applyReferralAttribution — both direct
    // DB updates, never through the auth API.
    referralCode: text("referral_code"),
    referredBy: text("referred_by").references((): AnyPgColumn => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("users_referral_code_uq").on(table.referralCode),
    index("users_referred_by_idx").on(table.referredBy),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("sessions_user_id_idx").on(table.userId)],
);

export const accounts = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("accounts_user_id_idx").on(table.userId)],
);

export const verifications = pgTable(
  "verifications",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("verifications_identifier_idx").on(table.identifier)],
);
