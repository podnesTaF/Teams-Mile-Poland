import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./auth";
import { eventHeats } from "./event-heats";
import { eventRegistrations } from "./event-registrations";
import { userTeams } from "./user-teams";
// Relative on purpose: drizzle-kit loads schema files outside the Next.js
// toolchain, where the `@/` alias may not resolve (same reason as `events.ts`,
// `consent.ts` and `user-teams.ts`). Type-only, so the module is erased before
// drizzle-kit ever resolves it.
import type { TeamCategory } from "../../features/teams/config";
import type { RaceRole, StageOption } from "../../features/teams/rating-rules";

/**
 * Team entry and race composition — a complete team racing a `team` event
 * (PRD #64, Contracts → DB schema).
 *
 * Two tables beside the formation stack (`user_team_*`, ADR 0008) and beside
 * the individual event stack (`event_*`), joined to both:
 *
 *  - {@link teamEntries} is "this team is racing that night", created by the
 *    manager pressing Enter. It is the row that carries the *race* facts that
 *    the roster must not: which heat, when the team checked in, and — the one
 *    piece of provenance that cannot be recomputed — which version of the
 *    rating rules the entry ran under.
 *  - {@link teamEntryMembers} is one seat per entered member, each pointing at
 *    a **real `event_registrations` row**. That indirection is the whole design
 *    (PRD #64, "Entry creates real registrations"): consent, tickets, bib
 *    leases, heats, results and the image-refusal list all key by
 *    `event_registrations.id`, so none of them needs a team branch. The seat
 *    adds only the race role, the pair and the reserve flag.
 *
 * Statuses and roles are `text` + `$type<>`, never pgEnum: `ALTER TYPE … ADD
 * VALUE` cannot run inside a transaction and is the shape that stranded
 * migration 0012 on the live database. `event_slug` is text with no FK, like
 * the six existing event tables (ADR 0005).
 *
 * Why the two `race_*` columns live here and not on `user_team_members`: the
 * roster is a standing fact that outlives any race night, while a composition
 * is fixed at one check-in for one event and is meaningless anywhere else. The
 * same runner can be an ACE on Tuesday and a RACER in October.
 */

/**
 * The entry lifecycle. `entered` the moment the manager presses Enter,
 * `checked_in` when the desk fixes the composition and leases the bibs (#69),
 * then `finished` / `dsq` once the night is scored (PRD B).
 *
 * There is deliberately no `withdrawn`: withdrawal is a hard delete of the
 * entry and its registrations (PRD #64, Implementation Decisions — the same
 * "hard operations, no soft state" rule formation follows for dissolve).
 */
export type TeamEntryStatus = "entered" | "checked_in" | "finished" | "dsq";


/** One team racing one event. Deleted outright when the entry is withdrawn. */
export const teamEntries = pgTable(
  "team_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => userTeams.id, { onDelete: "cascade" }),
    eventSlug: text("event_slug").notNull(),
    /**
     * A copy of the team's immutable category, frozen at entry. The team row
     * cannot change category, but it *can* be dissolved and this entry is the
     * only record of what raced — and PRD B ranks per category.
     */
    category: text("category").$type<TeamCategory>().notNull(),
    /**
     * Whoever pressed Enter: the manager, or an admin acting for the team.
     * `set null` rather than cascade — deleting an account must not delete the
     * fact that a team raced.
     */
    enteredByUserId: text("entered_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    /**
     * `RATING_RULES_VERSION` at the moment of entry. Stored, never re-derived:
     * a constant change (a stage option's nominal metres, a pair penalty) must
     * never rewrite a race that has already been run (PRD #64, user story 40).
     */
    ratingRulesVersion: text("rating_rules_version").notNull(),
    status: text("status").$type<TeamEntryStatus>().default("entered").notNull(),
    /** The heat the whole team is seeded into (#69); cleared if the heat goes. */
    heatId: uuid("heat_id").references(() => eventHeats.id, { onDelete: "set null" }),
    checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    /** One entry per team per event — this is what `already_entered` reads. */
    uniqueIndex("team_entries_team_event_uq").on(table.teamId, table.eventSlug),
    index("team_entries_event_idx").on(table.eventSlug),
  ],
);

/**
 * One entered member: the seat that ties a roster member to their real
 * registration and carries the race composition.
 *
 * The `race_*` columns are all nullable because they are written at check-in,
 * not at entry — an entered member has no role until the manager names one at
 * the desk. `is_reserve` is `false` until then too: before check-in nobody is a
 * reserve, everybody is simply entered.
 */
export const teamEntryMembers = pgTable(
  "team_entry_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => teamEntries.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /**
     * The member's registration for this event. `cascade` in both directions of
     * the withdrawal: deleting the entry drops the seats, and deleting the
     * registrations drops them too, so a withdraw can delete in either order
     * without orphaning a seat.
     */
    registrationId: uuid("registration_id")
      .notNull()
      .references(() => eventRegistrations.id, { onDelete: "cascade" }),
    /** RACER, ACE or JOKER — null until check-in fixes the composition. */
    raceRole: text("race_role").$type<RaceRole>(),
    /** 1 or 2. Pairs only; a RACER carries none. */
    pairNo: integer("pair_no"),
    /** Declared handover point. Pairs only, and equal within a pair. */
    stageOption: text("stage_option").$type<StageOption>(),
    /** Left out of the composition at check-in: no bib, swappable in (#69). */
    isReserve: boolean("is_reserve").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("team_entry_members_entry_user_uq").on(table.entryId, table.userId),
    /** A registration belongs to at most one entry seat. */
    uniqueIndex("team_entry_members_registration_uq").on(table.registrationId),
  ],
);

export type TeamEntryRow = typeof teamEntries.$inferSelect;
export type TeamEntryMemberRow = typeof teamEntryMembers.$inferSelect;
