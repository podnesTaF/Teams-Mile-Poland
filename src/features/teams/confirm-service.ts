import { and, eq } from "drizzle-orm";

import type { users } from "@/db/schema/auth";
import {
  consentSubmissions,
  type ConsentSnapshot,
  registrationConsents,
} from "@/db/schema/consent";
import { eventRegistrations } from "@/db/schema/event-registrations";
import type { TeamEntryRow } from "@/db/schema/team-entries";
import type { UserTeamRow } from "@/db/schema/user-teams";
import {
  type EventRegistrationRow,
  loadEventRegistration,
} from "@/features/event-registration/data";
import { getDb } from "@/lib/db";
import { getEventBySlug } from "@/lib/events/registry";
import { isPubliclyVisible } from "@/lib/events/store";
import { acceptsTeams, type EventSummary } from "@/lib/events/types";
import type { ConsentRowInput } from "@/lib/legal/consent";
import type { DocSlug } from "@/lib/legal/manifest";

import { getEntryWithTeam } from "./entries";

/**
 * Member confirmation (PRD #64, slice #68) — the read behind the screen and the
 * one transaction behind the button.
 *
 * The split is #67's: **everything here is already past the gate**.
 * `actions/confirm.ts` decides who may act (the registration's own session, or
 * the signed-ticket signature from the email) and which refusals apply; this
 * module answers "what is on this screen" and "write it, atomically".
 *
 * Not a `"use server"` module and not a component: the page imports
 * {@link loadConfirmScreen} directly, the action imports
 * {@link writeTeamConsent}, and a verification script can call either without
 * forging a session — the same reason `entries.ts` is shaped this way.
 *
 * Mail is deliberately absent. The ticket email is sent by the action *after*
 * this transaction commits, because a bounced mailbox must never roll back a
 * member's signed Statement (ADR 0006, and the individual path's own choice in
 * `event-registration/actions.ts`).
 */

/** The account row the screen prefills from — the member's own, never a session. */
type UserRow = typeof users.$inferSelect;

/**
 * Everything the confirmation screen and every one of its refusals need, in one
 * read: the registration, the member's account, the night, the entry and the
 * team.
 *
 * One shape for all of it because the guards interleave — the age refusal needs
 * the account *and* the event date, the cancelled banner needs the event, the
 * already-confirmed state needs the registration, and the form header names the
 * team. Fanning that out into five reads per render on a page a member opens on
 * a phone would be four round-trips for nothing.
 */
export type ConfirmScreenView = {
  registration: EventRegistrationRow;
  user: UserRow;
  event: EventSummary;
  entry: TeamEntryRow;
  team: UserTeamRow;
};

/**
 * Load the confirmation screen's subject, or `null` when there is nothing to
 * confirm here.
 *
 * `null` covers every "this URL names nothing" case, and the page turns all of
 * them into the same answer so the URL never reports *which* one it was:
 *
 *  - no such registration;
 *  - a registration with no `team_entry_id` — an individual runner's row, whose
 *    consent was captured at registration and who has no team documents to
 *    accept (the individual confirm step is `/events/[slug]/register`);
 *  - an entry whose team has since been dissolved;
 *  - an event that is missing, is not a team event, is the frozen legacy night
 *    (ADR 0008), or is a `draft`.
 *
 * A `cancelled` night is deliberately **not** null: the member is entitled to
 * be told the race is off rather than shown a 404, which is the issue's
 * cancelled-banner state, and its documents stay readable.
 */
export async function loadConfirmScreen(
  registrationId: string,
): Promise<ConfirmScreenView | null> {
  if (!registrationId || typeof registrationId !== "string") return null;

  const loaded = await loadEventRegistration(registrationId);
  if (!loaded) return null;

  const entryId = loaded.registration.teamEntryId;
  if (!entryId) return null;

  const found = await getEntryWithTeam(entryId);
  if (!found) return null;

  const event = await getEventBySlug(loaded.registration.eventSlug);
  if (!acceptsTeams(event) || !isPubliclyVisible(event)) {
    return null;
  }

  return {
    registration: loaded.registration,
    user: loaded.user,
    event,
    entry: found.entry,
    team: found.team,
  };
}

/** What {@link writeTeamConsent} was handed, minus everything it can derive. */
export type TeamConsentWrite = {
  registrationId: string;
  /**
   * The language the documents were **actually shown in** — not the profile
   * preference. Stored on the submission as the evidence of what was read, and
   * copied onto the registration; see {@link writeTeamConsent}.
   */
  locale: string;
  snapshot: ConsentSnapshot;
  /** Derived by the caller from the set's `acceptance` items (ADR 0006). */
  terms: boolean;
  ip: string | null;
  userAgent: string | null;
  consents: ConsentRowInput[];
};

/**
 * Write one member's team consent **and clear `consent_pending`, in one
 * transaction** (the issue's fourth acceptance criterion).
 *
 * Order inside the transaction is not the FK order the individual path uses —
 * it is the *locking* order, and it is the whole reason this returns a result
 * rather than `void`:
 *
 *  1. `UPDATE … SET consent_pending = false WHERE id = ? AND consent_pending`.
 *     A conditional update is the guard. Two taps on a phone, or a repeated
 *     server action, race the same row; the second one matches **zero rows**,
 *     writes nothing, and is reported as `already_confirmed`. Reading the flag
 *     and then writing it would leave a window in which both submissions passed
 *     the check and two `consent_submissions` rows were written for one act of
 *     ticking. The action's own `consent_pending` guard is the early, friendly
 *     refusal; this one is the invariant.
 *  2. The submission row, then its consent rows — the FK order, as in
 *     `createRegistrationWithConsent`.
 *
 * A failure anywhere — an unregistered document slug thrown by
 * `buildConsentRows`, a lost connection — rolls the flag back with the rows, so
 * "confirmed but no evidence" and "evidence but still pending" are both
 * unreachable states rather than unlikely ones.
 *
 * `terms` and `locale` are written onto the registration for the same reasons
 * the individual path writes them at insert time: the deprecated `terms`
 * boolean is derived from the set's acceptance items and never hardcoded, and
 * the registration's locale becomes the language the member actually used, so
 * the ticket email that follows speaks it. Entry copied `users.locale` there as
 * a best guess; this is the member telling us.
 */
export async function writeTeamConsent(
  input: TeamConsentWrite,
): Promise<{ ok: true; submissionId: string } | { ok: false; reason: "already_confirmed" }> {
  const db = getDb();

  return db.transaction(async (tx) => {
    const cleared = await tx
      .update(eventRegistrations)
      .set({
        consentPending: false,
        terms: input.terms,
        locale: input.locale,
      })
      .where(
        and(
          eq(eventRegistrations.id, input.registrationId),
          eq(eventRegistrations.consentPending, true),
        ),
      )
      .returning({ id: eventRegistrations.id });

    if (cleared.length === 0) {
      return { ok: false as const, reason: "already_confirmed" as const };
    }

    const [submission] = await tx
      .insert(consentSubmissions)
      .values({
        registrationId: input.registrationId,
        docSet: "team",
        locale: input.locale,
        snapshot: input.snapshot,
        ip: input.ip,
        userAgent: input.userAgent,
      })
      .returning({ id: consentSubmissions.id });

    await tx.insert(registrationConsents).values(
      input.consents.map((consent) => ({
        submissionId: submission.id,
        itemId: consent.itemId,
        kind: consent.kind,
        docSlug: consent.docSlug as DocSlug,
        docVersion: consent.docVersion,
        value: consent.value,
      })),
    );

    return { ok: true as const, submissionId: submission.id };
  });
}
