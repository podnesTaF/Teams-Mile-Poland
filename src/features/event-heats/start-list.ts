import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { eventHeats, eventRegistrations, teamEntries, teamEntryMembers, users } from "@/db/schema";
import { userTeams } from "@/db/schema/user-teams";
import type { TeamCategory } from "@/features/teams/config";
import type { RaceRole } from "@/features/teams/rating-rules";
import { getDb } from "@/lib/db";

/**
 * The public start list: what a spectator sees at
 * `/[locale]/events/[slug]/heats`.
 *
 * Read model only — the admin builder's own view of the card lives in
 * `features/admin/heats-data.ts` and carries fill counts, notify state and
 * everything else the desk needs. This module is deliberately the narrow public
 * projection of the same rows: **no bibs** (PRD #26), no email, no status.
 *
 * The bib omission is what keeps this page cheap to cache: because a bib never
 * appears, checking a runner in cannot change the page, so only publish /
 * heat-edit / finish invalidate it (see {@link revalidateStartList}).
 */

/** One runner as the start list names them. */
export type StartListEntry = {
  registrationId: string;
  name: string;
  club: string | null;
};

/**
 * One composed runner as a team event's start list names them: their role, and
 * their pair number when they run in one.
 *
 * **No bib**, exactly like {@link StartListEntry} — the omission is what keeps
 * this page cacheable (see the module comment), and it is the reason team
 * check-in has to invalidate the page explicitly: it changes the roles, not the
 * numbers.
 *
 * **Reserves are absent.** A start list is who is starting; a reserve is
 * somebody who might, and printing them next to the runners would be read as a
 * bigger team than the rules allow.
 */
export type StartListTeamMember = {
  registrationId: string;
  name: string;
  role: RaceRole;
  /** 1 or 2 for a pair member, `null` for a RACER. */
  pairNo: number | null;
};

/** One team in a heat of a team event, with its composed runners. */
export type StartListTeam = {
  entryId: string;
  name: string;
  category: TeamCategory;
  members: StartListTeamMember[];
};

/**
 * One published heat, with its runners in alphabetical order.
 *
 * `entries` is the individual projection and `teams` the team one (PRD #64
 * user story 37); a heat carries whichever of the two its event has, and the
 * other is empty. Two fields rather than a union because the page renders one
 * shape per event type and a union would make every existing call site narrow
 * something it already knows.
 */
export type StartListHeat = {
  number: number;
  scheduledAt: Date;
  entries: StartListEntry[];
  teams: StartListTeam[];
};

/**
 * An event's start list plus the one fact the page needs to tell its two empty
 * states apart: whether the event has any heats at all.
 *
 * - `totalHeats === 0` — nothing has been built; the page shows its empty state.
 * - `totalHeats > 0` with no `heats` — the card exists but is still draft, which
 *   is the explicit "not published yet" state, not an empty one.
 */
export type StartList = {
  totalHeats: number;
  heats: StartListHeat[];
};

/**
 * Published heats for an event with their runners.
 *
 * **Published only.** A draft heat is admin work-in-progress that nobody has
 * been emailed about; releasing it early would contradict the notification the
 * moment the card was rebalanced.
 *
 * **Deliberately not filtered by `status`.** Filtering out (say) a `no_show`
 * would make the page's content depend on a column that only check-in and the
 * roster actions write — and those must not invalidate this page (PRD #26: the
 * page is invalidated by publish / heat-edit / finish alone). A cached page plus
 * a status filter is a filter that does not actually run: the row would sit there
 * until the next heat mutation. So the projection depends on exactly the two
 * things that do invalidate it — which heats are published, and who is in them.
 * A runner who should not appear is taken off the card by unassigning them, which
 * is a heat edit and does invalidate.
 */
export async function getEventStartList(
  eventSlug: string,
  /**
   * Which projection to build. `"individual"` — the default, and byte-for-byte
   * what every existing caller has always received. `"team"` groups the same
   * published heats by team entry instead (PRD #64 user story 37).
   *
   * A parameter rather than a second function so there stays exactly one public
   * start-list read: the two projections must agree about which heats are
   * published and about the ISR contract, and two entry points would be two
   * places for that to drift.
   */
  kind: "individual" | "team" = "individual",
): Promise<StartList> {
  const db = getDb();

  const heats = await db
    .select({
      id: eventHeats.id,
      number: eventHeats.number,
      scheduledAt: eventHeats.scheduledAt,
      publishedAt: eventHeats.publishedAt,
    })
    .from(eventHeats)
    .where(eq(eventHeats.eventSlug, eventSlug))
    .orderBy(asc(eventHeats.number));

  const published = heats.filter((h) => h.publishedAt !== null);
  if (published.length === 0) {
    return { totalHeats: heats.length, heats: [] };
  }

  if (kind === "team") {
    const byHeat = await teamsByHeat(
      eventSlug,
      published.map((h) => h.id),
    );
    return {
      totalHeats: heats.length,
      heats: published.map((h) => ({
        number: h.number,
        scheduledAt: h.scheduledAt,
        entries: [],
        teams: byHeat.get(h.id) ?? [],
      })),
    };
  }

  const rows = await db
    .select({
      registrationId: eventRegistrations.id,
      heatId: eventRegistrations.heatId,
      firstName: users.firstName,
      lastName: users.lastName,
      fallbackName: users.name,
      club: users.club,
    })
    .from(eventRegistrations)
    .innerJoin(users, eq(eventRegistrations.userId, users.id))
    .where(
      and(
        eq(eventRegistrations.eventSlug, eventSlug),
        isNotNull(eventRegistrations.heatId),
        inArray(
          eventRegistrations.heatId,
          published.map((h) => h.id),
        ),
      ),
    )
    .orderBy(asc(users.lastName), asc(users.firstName));

  const byHeat = new Map<string, StartListEntry[]>();
  for (const row of rows) {
    if (!row.heatId) continue;
    const entry: StartListEntry = {
      registrationId: row.registrationId,
      name: [row.firstName, row.lastName].filter(Boolean).join(" ") || row.fallbackName,
      club: row.club,
    };
    const list = byHeat.get(row.heatId);
    if (list) list.push(entry);
    else byHeat.set(row.heatId, [entry]);
  }

  return {
    totalHeats: heats.length,
    heats: published.map((h) => ({
      number: h.number,
      scheduledAt: h.scheduledAt,
      entries: byHeat.get(h.id) ?? [],
      teams: [],
    })),
  };
}

/**
 * The composed runners of every team seated in one of `heatIds`, grouped by
 * heat then by team.
 *
 * The seating fact is `team_entries.heat_id` — a team is one unit on the card
 * (user story 34) — and the roles come off `team_entry_members`, which is where
 * check-in fixed them. Reserves and unnamed seats are filtered in SQL rather
 * than in the mapping, so a team that has entered but not checked in
 * contributes nothing and reads as absent instead of as a team of nobodies.
 *
 * Teams are ordered by name and their runners by role — RACERS, then pair 1,
 * then pair 2, ACE before JOKER — which is the order the rules describe a team
 * in and therefore the order a spectator expects to read it.
 */
async function teamsByHeat(
  eventSlug: string,
  heatIds: string[],
): Promise<Map<string, StartListTeam[]>> {
  const db = getDb();
  const rows = await db
    .select({
      entryId: teamEntries.id,
      heatId: teamEntries.heatId,
      category: teamEntries.category,
      teamName: userTeams.name,
      registrationId: teamEntryMembers.registrationId,
      raceRole: teamEntryMembers.raceRole,
      pairNo: teamEntryMembers.pairNo,
      firstName: users.firstName,
      lastName: users.lastName,
      fallbackName: users.name,
    })
    .from(teamEntryMembers)
    .innerJoin(teamEntries, eq(teamEntries.id, teamEntryMembers.entryId))
    .innerJoin(userTeams, eq(userTeams.id, teamEntries.teamId))
    .innerJoin(users, eq(users.id, teamEntryMembers.userId))
    .where(
      and(
        eq(teamEntries.eventSlug, eventSlug),
        isNotNull(teamEntries.heatId),
        inArray(teamEntries.heatId, heatIds),
        eq(teamEntryMembers.isReserve, false),
        isNotNull(teamEntryMembers.raceRole),
      ),
    )
    .orderBy(asc(userTeams.name), asc(users.lastName), asc(users.firstName));

  const byHeat = new Map<string, StartListTeam[]>();
  const byEntry = new Map<string, StartListTeam>();
  for (const row of rows) {
    if (!row.heatId) continue;
    let team = byEntry.get(row.entryId);
    if (!team) {
      team = {
        entryId: row.entryId,
        name: row.teamName,
        category: row.category,
        members: [],
      };
      byEntry.set(row.entryId, team);
      const list = byHeat.get(row.heatId);
      if (list) list.push(team);
      else byHeat.set(row.heatId, [team]);
    }
    team.members.push({
      registrationId: row.registrationId,
      name: [row.firstName, row.lastName].filter(Boolean).join(" ") || row.fallbackName,
      // Non-null: `race_role is not null` is in the WHERE clause.
      role: row.raceRole as RaceRole,
      pairNo: row.pairNo,
    });
  }

  const roleRank: Record<RaceRole, number> = { racer: 0, ace: 1, joker: 2 };
  for (const team of byEntry.values()) {
    team.members.sort((a, b) => {
      if ((a.pairNo ?? 0) !== (b.pairNo ?? 0)) return (a.pairNo ?? 0) - (b.pairNo ?? 0);
      return roleRank[a.role] - roleRank[b.role];
    });
  }
  return byHeat;
}

/**
 * Invalidate the public start list after a heat mutation.
 *
 * The route-pattern form (`[locale]` / `[slug]` as dynamic segments) covers
 * pl/en/ua and every event in one call — the same idiom the news actions use.
 * This is what makes the page server-rendered-then-cached rather than dynamic on
 * every request: publish, heat edit and finish call it, check-in does not,
 * because no bib is displayed (PRD #26 cross-cutting decision 4).
 *
 * Lives here rather than in `heat-actions.ts` so the race-morning actions can
 * reuse it — a `"use server"` module may only export async actions. **`markHeatFinished`
 * / `unmarkHeatFinished` (slice #32) must call this too**: finishing a heat is the
 * third mutation the contract names, and it does not exist yet.
 */
export function revalidateStartList(): void {
  revalidatePath("/[locale]/events/[slug]/heats", "page");
}
