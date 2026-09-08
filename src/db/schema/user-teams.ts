import { sql } from "drizzle-orm";
import { boolean, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { users } from "./auth";
// Relative on purpose: drizzle-kit loads schema files outside the Next.js
// toolchain, where the `@/` alias may not resolve (same reason as `events.ts`
// and `consent.ts`). Type-only, so the module is erased before drizzle-kit
// ever resolves it.
import type {
  TeamCategory,
  TeamInvitationStatus,
  TeamJoinRequestStatus,
  TeamRole,
} from "../../features/teams/config";

/**
 * Standing, account-backed teams — the team-formation model (PRD #57).
 *
 * These tables live *beside* the frozen warsaw-2026 `teams` / `runners` /
 * `slot_counter` stack under a `user_team_` prefix (ADR 0008): those rows have
 * no owner account and persisted people in their own `runners` rows, whereas a
 * member here is a `users` account on a roster.
 *
 * Category, roles and every status are `text` + `$type<>`, never pgEnum:
 * `ALTER TYPE … ADD VALUE` cannot run inside a transaction and is the shape
 * that stranded migration 0012 on the live database. The exhaustiveness that
 * matters is the compiler's — `TEAM_LIMITS` is a total `Record<TeamCategory,…>`.
 */

/** One team. Created once, dissolved by a hard delete; nothing references it yet. */
export const userTeams = pgTable(
  "user_teams",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /**
     * Generated once from the name and **never rewritten** — the same rule the
     * event slug follows. Renaming a team must not move its URL out from under
     * a share link a manager already sent.
     */
    slug: text("slug").notNull().unique(),
    /** 6 characters from `TEAM_CODE_ALPHABET`; rotatable by the manager. */
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    region: text("region").notNull(),
    /** Immutable after creation: `user_team_members.category` copies it. */
    category: text("category").$type<TeamCategory>().notNull(),
    /** "We are looking for runners" — the only flag; there is no team status. */
    recruiting: boolean("recruiting").default(false).notNull(),
    description: text("description"),
    managerUserId: text("manager_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    /**
     * Names are unique **case-insensitively**: "Warsaw Aces" and "warsaw aces"
     * are the same team to a human, and `name_taken` is checked with the same
     * `lower()` before the insert so the refusal is a message and not a 500.
     */
    uniqueIndex("user_teams_name_lower_uq").on(sql`lower(${table.name})`),
    index("user_teams_recruiting_idx").on(table.recruiting),
  ],
);

/** A roster seat. Membership is a `users` account, never a per-person row. */
export const userTeamMembers = pgTable(
  "user_team_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => userTeams.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").$type<TeamRole>().notNull(),
    /**
     * A copy of the team's immutable category, carried here so "one team per
     * category per runner" is a plain unique index rather than a query the
     * application has to remember to run (ADR 0008).
     */
    category: text("category").$type<TeamCategory>().notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("user_team_members_team_user_uq").on(table.teamId, table.userId),
    uniqueIndex("user_team_members_user_category_uq").on(table.userId, table.category),
  ],
);

/** A manager's (or the organiser's) offer to one email address. */
export const userTeamInvitations = pgTable(
  "user_team_invitations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => userTeams.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    /** sha256 of a `nanoid(32)`; the raw token exists only in the link. */
    tokenHash: text("token_hash").notNull().unique(),
    invitedByUserId: text("invited_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    /** True when an admin issued it on the team's behalf — changes the email copy. */
    onBehalf: boolean("on_behalf").default(false).notNull(),
    status: text("status").$type<TeamInvitationStatus>().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    /**
     * Whichever account opened the link — deliberately not required to match
     * `email`, because that breaks Gmail aliases and second addresses.
     */
    acceptedByUserId: text("accepted_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    /**
     * Partial: one *pending* invitation per team per address, so inviting the
     * same person twice resends rather than duplicating, while the declined and
     * revoked history stays.
     */
    uniqueIndex("user_team_invitations_team_email_pending_uq")
      .on(table.teamId, sql`lower(${table.email})`)
      .where(sql`${table.status} = 'pending'`),
    index("user_team_invitations_team_idx").on(table.teamId),
  ],
);

/** A runner knocking: created by entering the team code or from the public list. */
export const userTeamJoinRequests = pgTable(
  "user_team_join_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => userTeams.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status").$type<TeamJoinRequestStatus>().notNull(),
    decidedByUserId: text("decided_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    /** Partial: one open request per team per runner; withdrawn ones can be refiled. */
    uniqueIndex("user_team_join_requests_team_user_pending_uq")
      .on(table.teamId, table.userId)
      .where(sql`${table.status} = 'pending'`),
    index("user_team_join_requests_user_idx").on(table.userId),
  ],
);

export type UserTeamRow = typeof userTeams.$inferSelect;
export type UserTeamMemberRow = typeof userTeamMembers.$inferSelect;
export type UserTeamInvitationRow = typeof userTeamInvitations.$inferSelect;
export type UserTeamJoinRequestRow = typeof userTeamJoinRequests.$inferSelect;
