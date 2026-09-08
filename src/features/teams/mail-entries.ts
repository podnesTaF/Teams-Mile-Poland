import { and, eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";

import { eventEmailLog } from "@/db/schema/event-email-log";
import type { UserTeamRow } from "@/db/schema/user-teams";
import { signEventTicket } from "@/features/ticket/sign";
import { parseDateOnly } from "@/lib/age";
import { getAppUrl } from "@/lib/app-url";
import { getDb } from "@/lib/db";
import { localePath } from "@/lib/i18n/config";

import { ConfirmRequestEmail } from "./emails/confirm-request";
import { EntryWithdrawnEmail } from "./emails/entry-withdrawn";
import type { EntryMemberView } from "./entries";
import {
  asTeamMailLocale,
  formatTeamDate,
  sendTeamMail,
  teamMailFacts,
  type TeamMailLocale,
  type Translate,
} from "./mail-invitations";

/**
 * The two team-entry emails (#67): `team_confirm_request` and
 * `team_entry_withdrawn`.
 *
 * Transport, locale narrowing and the team-facts block all come from
 * `mail-invitations.ts` — there is **one** `sendTeamMail` for the whole
 * feature, so every team mail logs the same `[teams] mail skipped/failed` line
 * and Resend's "returns `{ error }` rather than throwing" trap is handled in
 * one place. Copy is resolved per *recipient* locale (`users.locale`), never per
 * request locale.
 *
 * What is new here, and the reason this file is not just two more functions in
 * `mail-roster.ts`: these two kinds are **logged** in `event_email_log`. The
 * formation mails have no registration to hang a log row off; an entry mail
 * does, and the log is load-bearing twice over —
 *
 *  - it is the idempotency record the PRD asks for, and
 *  - the `team_confirm_request` row's `sentAt` **is** the reminder clock that
 *    `remindMember` reads to enforce "at most once per 24 h".
 *
 * One row per (registration, kind) by unique index, so a re-send *updates* the
 * row rather than inserting a second one. See {@link logEntryMail}.
 */

/** Which of the two kinds a log write is for. Mirrors `event_email_kind`. */
export type EntryMailKind = "team_confirm_request" | "team_entry_withdrawn";

/** The occasion a confirm-request mail is being sent on. */
export type ConfirmRequestVariant = "entry" | "added" | "reminder";

/** Just the event facts these two mails name. */
export type EntryMailEvent = {
  slug: string;
  name: string;
  /** ISO `YYYY-MM-DD`, straight off `EventSummary.date`. */
  date: string;
};

/**
 * The confirmation link. **Fixed by the PRD's Routes table** and built in
 * exactly one place, because #68's confirmation screen has to verify what this
 * signs: `verifyEventTicket(registrationId, s)`.
 *
 * The signature is the ordinary event-ticket HMAC (`signEventTicket`), which is
 * why the link works with no session at all — the same passwordless mechanism
 * the ticket link already uses, and the reason a member's whole involvement can
 * be one tap on a phone (PRD #64, user story 20). Note the purpose string is
 * shared with the ticket on purpose: a member who has the link already has the
 * right to see their own registration.
 */
export function confirmLinkUrl(
  locale: string,
  eventSlug: string,
  registrationId: string,
): string {
  const path = `/events/${eventSlug}/confirm/${registrationId}?s=${signEventTicket(registrationId)}`;
  return `${getAppUrl()}${localePath(locale, path)}`;
}

/**
 * Record the send against the registration, idempotently.
 *
 * `onConflictDoUpdate` rather than `onConflictDoNothing` (which is what the
 * scheduled chain uses) for one reason: a reminder must move the clock. The
 * unique index is on (registration, kind), so the second `team_confirm_request`
 * for the same member has to overwrite the first — and `sentAt` is precisely
 * the value `remindMember` compares against `now - 24 h`. `onConflictDoNothing`
 * would freeze the clock at the entry and let a manager remind once an hour
 * forever.
 *
 * Never throws: the mail has already gone (or already failed), and losing the
 * log row must not turn a sent email into a failed action. Failures are logged
 * with `status = 'failed'` and the error text, so an unsent confirmation is
 * visible rather than silently absent.
 */
export async function logEntryMail(
  registrationId: string,
  kind: EntryMailKind,
  sent: boolean,
  error?: string,
): Promise<void> {
  try {
    const db = getDb();
    const now = new Date();
    await db
      .insert(eventEmailLog)
      .values({
        eventRegistrationId: registrationId,
        kind,
        status: sent ? "sent" : "failed",
        error: sent ? null : (error ?? "send returned false"),
        sentAt: now,
      })
      .onConflictDoUpdate({
        target: [eventEmailLog.eventRegistrationId, eventEmailLog.kind],
        set: {
          status: sent ? "sent" : "failed",
          error: sent ? null : (error ?? "send returned false"),
          sentAt: now,
        },
      });
  } catch (err) {
    console.error(`[teams] could not log ${kind} for registration ${registrationId}:`, err);
  }
}

/**
 * When the member was last asked to confirm — the reminder clock.
 *
 * Reads `sentAt` off the (registration, `team_confirm_request`) row, whatever
 * its status: a *failed* send still counts as an attempt, because otherwise a
 * misconfigured mailer would let a manager retry in a loop. `null` when no
 * attempt has ever been logged, which is the "go ahead" answer.
 */
export async function lastConfirmRequestAt(registrationId: string): Promise<Date | null> {
  const db = getDb();
  const [row] = await db
    .select({ sentAt: eventEmailLog.sentAt })
    .from(eventEmailLog)
    .where(
      and(
        eq(eventEmailLog.eventRegistrationId, registrationId),
        eq(eventEmailLog.kind, "team_confirm_request"),
      ),
    )
    .limit(1);
  return row?.sentAt ?? null;
}

/** "<event name> · <17 October 2026>" — the subtitle both templates carry. */
function eventSub(event: EntryMailEvent, locale: TeamMailLocale): string {
  return `${event.name} · ${formatTeamDate(parseDateOnly(event.date), locale)}`;
}

/**
 * Ask one member to confirm their participation, and log the attempt.
 *
 * Returns whether the mail actually went out. The caller does **not** roll
 * anything back on `false`: the entry exists, the registration exists, and the
 * manager can press Remind — which is exactly why the failure is written to the
 * log with its error rather than swallowed.
 */
export async function sendConfirmRequestEmail({
  variant,
  member,
  team,
  event,
}: {
  variant: ConfirmRequestVariant;
  member: EntryMemberView;
  team: Pick<UserTeamRow, "slug" | "name" | "category" | "region">;
  event: EntryMailEvent;
}): Promise<boolean> {
  const locale = asTeamMailLocale(member.locale);
  const t = (await getTranslations({
    locale,
    namespace: "teams.emails.confirmRequest",
  })) as Translate;
  const { facts, labels } = await teamMailFacts(locale, team, t);

  const introKey =
    variant === "added" ? "introAdded" : variant === "reminder" ? "introReminder" : "introEntry";

  const sent = await sendTeamMail({
    to: member.email,
    locale,
    subject:
      variant === "reminder"
        ? t("subjectReminder", { event: event.name })
        : t("subject", { event: event.name }),
    react: ConfirmRequestEmail({
      preview: t("preview", { event: event.name }),
      eyebrow: t("eyebrow"),
      title: t("title"),
      sub: eventSub(event, locale),
      greeting: t("greeting", { name: member.firstName }),
      intro: t(introKey, { team: team.name, event: event.name }),
      body: t("body"),
      outro: t("outro"),
      team: facts,
      labels,
      cta: {
        label: t("cta"),
        href: confirmLinkUrl(locale, event.slug, member.registrationId),
      },
      note: t("note"),
    }),
  });

  await logEntryMail(member.registrationId, "team_confirm_request", sent);
  return sent;
}

/**
 * Tell one member their team's entry has been withdrawn, and log it.
 *
 * Called **before** the rows are deleted (see `withdrawEntryRows`), so the log
 * row it writes is deleted moments later with the registration it references.
 * That is deliberate and worth stating plainly: the PRD's "logs
 * `team_entry_withdrawn` per member" criterion is satisfied by the write
 * itself and by the `[teams]` console lines — a withdrawal leaves no
 * registration for a log row to hang off, and inventing a
 * registration-independent audit table for it is out of scope here.
 */
export async function sendEntryWithdrawnEmail({
  member,
  team,
  event,
}: {
  member: EntryMemberView;
  team: Pick<UserTeamRow, "slug" | "name" | "category" | "region">;
  event: EntryMailEvent;
}): Promise<boolean> {
  const locale = asTeamMailLocale(member.locale);
  const t = (await getTranslations({
    locale,
    namespace: "teams.emails.entryWithdrawn",
  })) as Translate;
  const { facts, labels } = await teamMailFacts(locale, team, t);

  const sent = await sendTeamMail({
    to: member.email,
    locale,
    subject: t("subject", { event: event.name }),
    react: EntryWithdrawnEmail({
      preview: t("preview", { team: team.name, event: event.name }),
      eyebrow: t("eyebrow"),
      title: t("title"),
      sub: eventSub(event, locale),
      greeting: t("greeting", { name: member.firstName }),
      intro: t("intro", { team: team.name, event: event.name }),
      outro: t("outro"),
      team: facts,
      labels,
      cta: {
        label: t("cta"),
        href: `${getAppUrl()}${localePath(locale, `/teams/${team.slug}`)}`,
      },
    }),
  });

  await logEntryMail(member.registrationId, "team_entry_withdrawn", sent);
  return sent;
}
