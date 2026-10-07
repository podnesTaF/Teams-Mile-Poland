import { and, eq, inArray, or } from "drizzle-orm";

import { eventEmailLog, walletTransactions } from "@/db/schema";
import { eventPayments } from "@/db/schema/event-payments";
import { getAppUrl } from "@/features/registration/data";
import { teamEntryFeeKey } from "@/features/teams/entries";
import { generateTicketQrPng } from "@/features/ticket/qr";
import { signEventTicket } from "@/features/ticket/sign";
import { EventTicketEmail, eventTicketSubject } from "@/emails/event-ticket";
import { getDb } from "@/lib/db";
import { getEventBySlug } from "@/lib/events/registry";
import type { EventSummary } from "@/lib/events/types";
import { FROM_EMAIL, resend } from "@/lib/email";
import { defaultLocale } from "@/lib/i18n/config";
import { individualEntryFeeKey } from "@/features/wallet/refunds";

import type { EventRegistrationRow } from "./data";

/** Minimal user shape a ticket needs — satisfied by the DB row and the session user. */
type TicketUser = {
  email: string;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  club?: string | null;
};

export type EventTicketView = {
  registrationId: string;
  fullName: string;
  email: string;
  club: string | null;
  status: EventRegistrationRow["status"];
  bib: number | null;
  eventName: string;
  eventDateLabel: string;
  eventTime: string | null;
  eventVenue: string;
  checkedInAt: Date | null;
  /** What the entry cost, already worded for the ticket ("Free", "Paid · 50.00 PLN"). */
  entryLabel: string;
};

/**
 * What was actually paid for a registration. `null` means free — the night
 * was unpriced, or the runner was comped.
 *
 * There is no payment column on the registration (see `event_registrations`),
 * so this reads the two places money can live: a fulfilled Stripe session
 * (`event_payments`), and the ACER ledger debit keyed on the cause. Either can
 * be the runner's own (keyed on the registration) or the team's (keyed on the
 * team entry the registration belongs to).
 */
export type EntryFee = {
  amountMinor: number;
  currency: "PLN" | "ACER";
  viaTeam: boolean;
};

export async function loadEntryFee(
  registration: Pick<EventRegistrationRow, "id" | "teamEntryId">,
): Promise<EntryFee | null> {
  const db = getDb();
  const teamEntryId = registration.teamEntryId ?? null;

  const [stripe] = await db
    .select({ amountMinor: eventPayments.amountMinor, teamEntryId: eventPayments.teamEntryId })
    .from(eventPayments)
    .where(
      and(
        eq(eventPayments.status, "fulfilled"),
        teamEntryId
          ? or(
              eq(eventPayments.registrationId, registration.id),
              eq(eventPayments.teamEntryId, teamEntryId),
            )
          : eq(eventPayments.registrationId, registration.id),
      ),
    )
    .limit(1);
  if (stripe) {
    return { amountMinor: stripe.amountMinor, currency: "PLN", viaTeam: stripe.teamEntryId !== null };
  }

  const keys = [individualEntryFeeKey(registration.id)];
  if (teamEntryId) keys.push(teamEntryFeeKey(teamEntryId));
  const [ledger] = await db
    .select({ amountMinor: walletTransactions.amountMinor, kind: walletTransactions.kind })
    .from(walletTransactions)
    .where(inArray(walletTransactions.idempotencyKey, keys))
    .limit(1);
  if (ledger && ledger.amountMinor !== 0) {
    return {
      amountMinor: Math.abs(ledger.amountMinor),
      currency: "ACER",
      viaTeam: ledger.kind === "team_entry_fee",
    };
  }

  return null;
}

/** The ticket's "Entry" line. English, like the rest of the ticket's literals. */
export function entryLabelOf(fee: EntryFee | null): string {
  if (!fee) return "Free";
  const amount = new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(fee.amountMinor / 100);
  return fee.viaTeam
    ? `Paid by team · ${amount} ${fee.currency}`
    : `Paid · ${amount} ${fee.currency}`;
}

function fullNameOf(user: TicketUser): string {
  const composed = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return composed || user.name || user.email;
}

/** Locale-aware public ticket URL, signed so check-in staff scan back to it. */
export function makeEventTicketUrl(registrationId: string, opts: { locale?: string } = {}): string {
  const locale = opts.locale ?? defaultLocale;
  const prefix = locale === defaultLocale ? "" : `/${locale}`;
  const sig = signEventTicket(registrationId);
  return `${getAppUrl()}${prefix}/tickets/${encodeURIComponent(registrationId)}?s=${encodeURIComponent(sig)}`;
}

/**
 * Localized "set a password" CTA for the ticket email. Guests register
 * passwordlessly, so the ticket carries a link to set a real password for
 * later sign-in (points at the app's password-set entry — the reset email
 * system itself is unchanged).
 */
const SET_PASSWORD_COPY: Record<string, { line: string; cta: string }> = {
  en: {
    line: "Set a password to sign in later and manage your registration.",
    cta: "Set a password",
  },
  pl: {
    line: "Ustaw hasło, aby móc się później zalogować i zarządzać swoją rejestracją.",
    cta: "Ustaw hasło",
  },
  ua: {
    line: "Встановіть пароль, щоб згодом увійти та керувати своєю реєстрацією.",
    cta: "Встановити пароль",
  },
};

function setPasswordCta(locale: string): { line: string; cta: string; url: string } {
  const copy = SET_PASSWORD_COPY[locale] ?? SET_PASSWORD_COPY[defaultLocale];
  const prefix = locale === defaultLocale ? "" : `/${locale}`;
  return { ...copy, url: `${getAppUrl()}${prefix}/auth/forgot-password` };
}

/** Build a render-ready ticket view from a registration + user + event config. */
export function buildEventTicketView(
  registration: EventRegistrationRow,
  user: TicketUser,
  event: EventSummary | undefined,
  fee: EntryFee | null = null,
): EventTicketView {
  return {
    registrationId: registration.id,
    fullName: fullNameOf(user),
    email: user.email,
    club: user.club ?? null,
    status: registration.status,
    bib: registration.bib ?? null,
    eventName: event?.name ?? "Individual Mile",
    eventDateLabel: event?.shortDate ?? registration.eventSlug,
    eventTime: event?.timeRange ? `${event.timeRange.start}–${event.timeRange.end}` : null,
    eventVenue: event ? `${event.venue}, ${event.city}` : "",
    checkedInAt: registration.checkedInAt ?? null,
    entryLabel: entryLabelOf(fee),
  };
}

/**
 * Send the confirmation email with an embedded, scannable QR ticket.
 *
 * Idempotent per `(event_registration_id, "confirmation")`: the send is logged
 * once in `event_email_log`, and a subsequent call for the same registration
 * short-circuits before re-sending. Mirrors the reminder-chain pattern — only
 * successful sends are logged, so a failed send (which throws) retries cleanly.
 * The single choke point covers both the signed-in and guest registration paths.
 */
export async function sendEventTicketEmail(input: {
  registration: EventRegistrationRow;
  user: TicketUser;
}) {
  const event = await getEventBySlug(input.registration.eventSlug);
  const view = buildEventTicketView(
    input.registration,
    input.user,
    event,
    await loadEntryFee(input.registration),
  );
  const ticketUrl = makeEventTicketUrl(input.registration.id, {
    locale: input.registration.locale,
  });

  if (!resend) {
    // No transport (local runs, verify scripts): a skip, not a send.
    return { ticketUrl, sent: false };
  }

  const db = getDb();
  const [already] = await db
    .select({ id: eventEmailLog.id })
    .from(eventEmailLog)
    .where(
      and(
        eq(eventEmailLog.eventRegistrationId, input.registration.id),
        eq(eventEmailLog.kind, "confirmation"),
        eq(eventEmailLog.status, "sent"),
      ),
    )
    .limit(1);
  if (already) {
    return { ticketUrl, sent: true };
  }

  const qrCid = "event-ticket-qr";
  const qrBuffer = await generateTicketQrPng(ticketUrl);

  // Resend's `send()` RETURNS `{ error }` rather than throwing, so the result
  // has to be read — the unchecked idiom logged a rejected send as `sent` and
  // the runner never got a ticket (PRD #64 #68, "with the Resend result
  // checked"). A failure is logged as `failed` with the message; the `already`
  // guard above only honours `sent`, so the next call retries the send and the
  // upsert below flips the row to `sent` when it goes through.
  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: view.email,
    subject: eventTicketSubject(view),
    react: EventTicketEmail({
      view,
      ticketUrl,
      qrCid,
      setPassword: setPasswordCta(input.registration.locale),
    }),
    attachments: [{ filename: "ticket-qr.png", content: qrBuffer, contentId: qrCid }],
  });

  const sent = !error;
  if (error) {
    console.error(
      `[ticket] confirmation mail failed for registration ${input.registration.id}:`,
      error,
    );
  }

  // One `confirmation` row per registration: the unique (registration, kind)
  // index turns a concurrent double-insert into an update of the same row.
  await db
    .insert(eventEmailLog)
    .values({
      eventRegistrationId: input.registration.id,
      kind: "confirmation",
      status: sent ? "sent" : "failed",
      error: sent ? null : String(error?.message ?? error),
    })
    .onConflictDoUpdate({
      target: [eventEmailLog.eventRegistrationId, eventEmailLog.kind],
      set: {
        status: sent ? "sent" : "failed",
        error: sent ? null : String(error?.message ?? error),
        sentAt: new Date(),
      },
    });

  return { ticketUrl, sent };
}
