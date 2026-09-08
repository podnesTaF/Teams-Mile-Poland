"use server";

import { headers } from "next/headers";

import {
  makeEventTicketUrl,
  sendEventTicketEmail,
} from "@/features/event-registration/ticket";
import {
  consentSubmissionSchema,
  type ConsentSubmissionInput,
} from "@/features/event-registration/schemas";
import { verifyEventTicket } from "@/features/ticket/sign";
import {
  coerceToDate,
  formatDateOnly,
  meetsMinParticipantAge,
  parseDateOnly,
} from "@/lib/age";
import { getUser } from "@/lib/auth/user-session";
import {
  buildConsentRows,
  type ConsentProblem,
  termsAcceptedFrom,
  validateConsentItems,
} from "@/lib/legal/consent";

import { teamFailure, type TeamActionFailure } from "../config";
import { loadConfirmScreen, writeTeamConsent } from "../confirm-service";

/**
 * Member confirmation (#68) — the one action a regular member ever calls.
 *
 * Everything a manager does is `actions/entries.ts`; this is the other half of
 * PRD #64's bargain: *the manager carries everything except the personal
 * declaration*. A member opens one link, reads, ticks, presses one button, and
 * this writes their consent evidence and sends their ticket (user stories
 * 16–23).
 *
 * The shape is the team feature's frozen one — `{ ok: true, … } | { ok: false,
 * reason, message }` via `teamFailure` — with two additions documented on
 * {@link TeamConfirmFailure}. Nothing here writes a query of its own: the read
 * and the transaction are `../confirm-service`, the ticket mail is the existing
 * `sendEventTicketEmail`, and the item set comes from the legal manifest.
 */

/**
 * A refusal that can point at the box the member missed.
 *
 * Two additions to the frozen failure shape, for the same reason #67's
 * `EntryFailure` has two:
 *
 *  - `consent` — the field-level detail (`missing` / `invalid` / `unknown` item
 *    ids, plus `fields` for the emergency-contact and address inputs). A banner
 *    saying "check the consent section" on a six-checkbox form is not an answer;
 *    this is the same `ConsentProblem` the individual path returns (#53, user
 *    story 12), so the reused `ConsentFields` island highlights team items the
 *    way it highlights individual ones.
 *  - `ticketUrl` — present on `already_confirmed` and on success. A member who
 *    double-taps, or opens the emailed link a second time, wants their ticket,
 *    not an error: the screen shows the link without a reload.
 *
 * No reason key was added — the set is frozen in `config.ts` for all three
 * slices of this PRD, and `invalid` is the key a malformed submission gets.
 */
export type TeamConfirmFailure = TeamActionFailure & {
  consent?: ConsentProblem & { fields: Record<string, string> };
  ticketUrl?: string;
};

export type TeamConfirmResult = { ok: true; ticketUrl: string } | TeamConfirmFailure;

/**
 * Best-effort request IP, recorded on the consent submission as evidence of
 * where the acceptance came from (ADR 0006).
 *
 * A deliberate second copy of the individual path's helper
 * (`event-registration/actions.ts`), which is module-private inside a
 * `"use server"` file and cannot be exported without becoming a server action.
 * Four lines duplicated rather than a shared module that would exist solely to
 * hold them; nullable on purpose — an absent IP is recorded as absent, never as
 * a guess.
 */
function requestIp(h: Headers): string | null {
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim() || null;
  return h.get("x-real-ip");
}

/** The `phoneEmail` line the Statement prints — same composition as #53's. */
function phoneEmailLine(email: string, phone: string | null | undefined): string {
  return [phone?.trim(), email].filter(Boolean).join(" · ");
}

/**
 * Confirm one member's participation in their team's entry.
 *
 * **Who may call it** is the passwordless half of the PRD (Cross-Cutting
 * Decision 2, user stories 20–21): the registration's own session, **or** the
 * signed-ticket signature carried by the emailed link. The signature is the
 * ordinary `event-ticket` HMAC that `confirmLinkUrl` (#67) signs, so a member on
 * a phone never meets a password — and it authorizes nothing a session would
 * not: it names one registration and grants exactly the right to act on it.
 * Anyone else is `forbidden`, session or no session.
 *
 * **The guard order** is the issue's, and it is the order a human would explain
 * a refusal in: this link names nothing → you may not act on it → you have
 * already confirmed → you will not be 18 on the night → the night is off → what
 * you sent is not a valid team submission.
 *
 * Age is checked against **the event date** (`parseDateOnly(event.date)`), not
 * today — brief Decision 7, and the same date entry and check-in use. A
 * declaration that says "on the day of the event I am 18 or older" must be
 * refused when it would be false, and a 17-year-old confirming in September for
 * a November race is not lying.
 *
 * **Consent is re-derived from the manifest, never trusted.** The client is told
 * which six items to render, but `docSet` must be `"team"` and
 * `validateConsentItems("team", …)` decides whether a submission may be written
 * — so a client that drops a required box, ticks the image question instead of
 * answering it, or invents an item id is refused regardless of what it rendered
 * (the issue's fifth criterion). `"disagree"` on the image question is a
 * complete, confirming answer: refusing image use costs nobody their place,
 * which is why it is a `consent`-kind item and not a sixth acceptance.
 *
 * The ticket email is sent **after** the transaction commits and its failure
 * never changes the result. The member is confirmed; telling them otherwise
 * because a mailbox bounced would be a lie, and the ticket is reachable from
 * their profile and re-sendable.
 */
export async function confirmTeamParticipation(
  registrationId: string,
  consent: ConsentSubmissionInput,
  sig?: string,
): Promise<TeamConfirmResult> {
  if (!registrationId || typeof registrationId !== "string") return teamFailure("invalid");

  const screen = await loadConfirmScreen(registrationId);
  if (!screen) return teamFailure("notfound");
  const { registration, user, event } = screen;

  // Session **or** signature — see the doc comment. `getUser` is cached per
  // request, so this costs nothing on a signed link.
  const session = await getUser();
  const bySession = session?.id === registration.userId;
  const bySignature = typeof sig === "string" && sig.length > 0 && verifyEventTicket(registrationId, sig);
  if (!bySession && !bySignature) return teamFailure("forbidden");

  const ticketUrl = makeEventTicketUrl(registrationId, { locale: registration.locale });

  if (!registration.consentPending) {
    return { ...teamFailure("already_confirmed"), ticketUrl };
  }

  const eventDate = parseDateOnly(event.date);
  const dob = coerceToDate(user.dateOfBirth);
  if (!dob || !meetsMinParticipantAge(dob, eventDate)) return teamFailure("age");

  if (event.status === "cancelled") return teamFailure("cancelled");

  const parsed = consentSubmissionSchema.safeParse(consent);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors as Record<string, string[]>;
    return {
      ...teamFailure("invalid"),
      consent: {
        missing: [],
        invalid: [],
        unknown: [],
        fields: Object.fromEntries(
          Object.entries(fieldErrors).map(([key, messages]) => [key, messages[0] ?? "Invalid"]),
        ),
      },
    };
  }
  const submission = parsed.data;

  // The set is the event's, not the client's. A submission naming the
  // individual corpus would otherwise be validated against items this screen
  // never showed — and would store consent to documents nobody read.
  if (submission.docSet !== "team") {
    return { ...teamFailure("invalid"), consent: { missing: [], invalid: [], unknown: [], fields: {} } };
  }

  const problem = validateConsentItems("team", submission.items);
  if (problem) {
    return { ...teamFailure("invalid"), consent: { ...problem, fields: {} } };
  }

  const fullName =
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.name || user.email;

  const written = await writeTeamConsent({
    registrationId,
    locale: submission.locale,
    terms: termsAcceptedFrom("team", submission.items),
    snapshot: {
      fullName,
      birthDate: formatDateOnly(dob),
      phoneEmail: phoneEmailLine(user.email, user.phone),
      address: submission.address ?? "",
      emergencyContact: submission.emergencyContact,
    },
    ip: requestIp(await headers()),
    userAgent: (await headers()).get("user-agent"),
    consents: buildConsentRows("team", submission.items),
  });

  if (!written.ok) {
    // Lost the race against another tab (or the member's second tap). Their
    // consent is on record from the winning submission — hand them the ticket.
    return { ...teamFailure("already_confirmed"), ticketUrl };
  }

  // Outside the transaction, and its outcome is checked rather than assumed.
  //
  // `sendEventTicketEmail` is the existing single choke point for this mail
  // (idempotent per `(registration, "confirmation")`); it reads Resend's
  // `{ error }` and reports `sent` back, logging a refusal as `failed`. A throw
  // or a refusal must not surface as a failed confirmation, because the consent
  // is committed and irreversible. So the failure is logged with the
  // registration id — the operator needs to know a ticket did not go out — and
  // the member is still told they are confirmed.
  //
  // The registration row is passed as it was read, with `consent_pending` still
  // true in memory: the ticket reads only id, status, bib, locale and
  // `checkedInAt`, and none of them changed. `locale` is the submission's, so
  // the ticket speaks the language the member just read the documents in.
  try {
    const sent = await sendEventTicketEmail({
      registration: { ...registration, locale: submission.locale },
      user,
    });
    if (sent.sent) {
      console.info(
        `[teams] confirmation ticket dispatched for registration ${registrationId} → ${sent.ticketUrl}`,
      );
    } else {
      // A skip (no transport) or a Resend refusal, already logged by the sender
      // as `failed` in `event_email_log`; the member is confirmed either way.
      console.warn(
        `[teams] confirmed registration ${registrationId} but no ticket email went out`,
      );
    }
  } catch (error) {
    console.error(
      `[teams] confirmed registration ${registrationId} but the ticket email failed:`,
      error,
    );
  }

  // Nothing to revalidate. The profile card that flips from "awaiting your
  // confirmation" to the ticket state, the manager's checklist and the
  // organiser's confirmed counts are all on dynamic pages; the one statically
  // generated surface in this PRD — the event page's entered-*teams* count —
  // is unchanged by a member confirming.
  return { ok: true, ticketUrl: makeEventTicketUrl(registrationId, { locale: submission.locale }) };
}
