import { revalidatePath } from "next/cache";

import type { UserTeamRow } from "@/db/schema/user-teams";
import { meetsMinParticipantAge, parseDateOnly } from "@/lib/age";
import { getEventBySlug } from "@/lib/events/registry";
import { isPubliclyVisible } from "@/lib/events/store";
import { acceptsTeams, type EventSummary } from "@/lib/events/types";

import { teamFailure, type TeamActionFailure } from "./config";
import { entryShortfall } from "./eligibility";
import {
  createEntryRows,
  findIndividuallyRegistered,
  getEntryByTeamAndEvent,
  getEntryMembers,
  getTeamEntryCandidates,
} from "./entries";
import { sendConfirmRequestEmail, type EntryMailEvent } from "./mail-entries";

/**
 * The ungated half of entering a team: the roster checks and the write.
 *
 * Split out of `actions/entries.ts` because there are two callers now and only
 * one of them is a manager's browser. `enterTeam` runs these after
 * `requireTeamManagerOrAdmin`; the Stripe webhook runs them after a paid team
 * entry settles (`features/event-payments`), where there is no session and the
 * signature is the authentication. A `"use server"` module would publish these
 * as endpoints anyone could call without the gate, so they live here instead.
 */

/**
 * A refusal that can name what it is refusing over.
 *
 * The frozen failure shape (`{ ok: false, reason, message }`) is a *key*, not a
 * sentence, and `teams.reasons.incomplete_team` cannot say "two more needed"
 * without one. So two refusals carry a datum alongside the key — the issue asks
 * for `incomplete_team` "with the count needed" and `member_underage` "naming
 * the member" — and the copy for those detailed variants lives in
 * `teams.entry.*`, with `teams.reasons.*` as the fallback. No reason key was
 * added: the reason set is frozen in `config.ts` for all three slices.
 */
export type EntryFailure = TeamActionFailure & {
  /** `incomplete_team`: members still needed before the team could field a race composition. */
  missing?: number;
  /** `member_underage`: the member who will not be 18 on the event date;
   * `registered_individually`: the member already registered alone (ADR 0009). */
  memberName?: string;
  /**
   * `treasury_insufficient`: what the night costs and what the treasury holds,
   * both in ACER **minor units**, read together so they cannot disagree. See
   * `enterTeam` for why it is two numbers and not a shortfall.
   */
  feeMinor?: number;
  treasuryMinor?: number;
};

export type EntryActionResult<T = object> = ({ ok: true } & T) | EntryFailure;

type EntryRoster = Awaited<ReturnType<typeof getTeamEntryCandidates>>;

/** The event facts the two mails name, from the summary the action already holds. */
export function toMailEvent(event: EventSummary): EntryMailEvent {
  return { slug: event.slug, name: event.name, date: event.date };
}

/**
 * The public event page shows the entered-teams count, and it is statically
 * generated (PRD #64, Cross-Cutting Decision 4) — so entering and withdrawing
 * have to push the new count out themselves.
 *
 * The route-pattern form covers pl/en/ua in one call, and covers every event's
 * page rather than one slug's, because `[slug]` is a pattern and not a value —
 * the same trade `revalidateEventSurfaces` makes and for the same reason. The
 * entry page itself is dynamic and needs no invalidation.
 */
export function revalidateEntrySurfaces(): void {
  revalidatePath("/[locale]/events/[slug]", "page");
}

/**
 * Resolve an event slug to a **team event that can still be acted on**: it
 * exists, it is not the frozen legacy night, and it is publicly visible.
 *
 * A `draft` is `notfound` here for the same reason it 404s on every public
 * surface: it has not been announced, so from outside `/admin` it does not
 * exist. Lifecycle refusals past that point (`cancelled`, `not_open`) differ per
 * action and stay at the call sites.
 */
export async function loadTeamEvent(eventSlug: string): Promise<EventSummary | null> {
  const event = await getEventBySlug(eventSlug);
  if (!event) return null;
  if (!acceptsTeams(event) || !isPubliclyVisible(event)) return null;
  return event;
}

/**
 * Whether this team could be entered into this event right now, and the roster
 * it would be entered with.
 *
 * Everything `enterTeam` refuses over after the gate and the lifecycle check:
 * already entered → cannot field a race composition → a member will not be 18
 * on the night → a member already registered alone. See `enterTeam` for why
 * each one exists.
 */
export async function checkTeamEntry(
  team: UserTeamRow,
  event: EventSummary,
): Promise<{ ok: true; roster: EntryRoster } | EntryFailure> {
  if (await getEntryByTeamAndEvent(team.id, event.slug)) return teamFailure("already_entered");

  const roster = await getTeamEntryCandidates(team.id);
  const shortfall = entryShortfall(team.category, roster);
  if (shortfall > 0) {
    return { ...teamFailure("incomplete_team"), missing: shortfall };
  }

  const eventDate = parseDateOnly(event.date);
  const underage = roster.find(
    (member) => !member.dateOfBirth || !meetsMinParticipantAge(member.dateOfBirth, eventDate),
  );
  if (underage) {
    return { ...teamFailure("member_underage"), memberName: underage.displayName };
  }

  // One entry path per runner per night (ADR 0009): on a mixed night a member
  // who already registered alone is named, and the manager sorts it out with
  // them — the platform never silently converts their registration.
  const solo = await findIndividuallyRegistered(
    event.slug,
    roster.map((member) => member.userId),
  );
  const soloMember = roster.find((member) => solo.has(member.userId));
  if (soloMember) {
    return { ...teamFailure("registered_individually"), memberName: soloMember.displayName };
  }

  return { ok: true, roster };
}

/**
 * Write the entry for a roster {@link checkTeamEntry} accepted, mail every
 * member their confirmation link, and refresh the public count.
 *
 * `feeMinor` is the ACER treasury debit taken in the same transaction (ADR
 * 0013); the Stripe path passes 0, because its fee was paid by card.
 */
export async function writeTeamEntry({
  team,
  event,
  roster,
  actorUserId,
  feeMinor,
}: {
  team: UserTeamRow;
  event: EventSummary;
  roster: EntryRoster;
  /** Whoever pressed Enter (or paid for it) — the manager, or an admin acting for the team. */
  actorUserId: string;
  feeMinor: number;
}): Promise<EntryActionResult<{ entryId: string }>> {
  const created = await createEntryRows({
    team,
    eventSlug: event.slug,
    actorUserId,
    seats: roster.map((member) => ({ userId: member.userId, locale: member.locale })),
    feeMinor,
  });
  if (!created.ok) return created;

  // Read the seats back rather than reusing `roster`: `getEntryMembers` is the
  // one shape that carries the registration id the confirmation link is built
  // from, and it is the shape the checklist and #69's desk read too.
  for (const member of await getEntryMembers(created.entryId)) {
    await sendConfirmRequestEmail({ variant: "entry", member, team, event: toMailEvent(event) });
  }

  revalidateEntrySurfaces();
  return { ok: true, entryId: created.entryId };
}
