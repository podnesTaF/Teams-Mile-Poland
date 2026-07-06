import { boolean, date, index, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";

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

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
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
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

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
