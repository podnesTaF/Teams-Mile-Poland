import { and, eq } from "drizzle-orm";

import { eventEmailLog } from "@/db/schema";
import { getAppUrl } from "@/features/registration/data";
import { generateTicketQrPng } from "@/features/ticket/qr";
import { signEventTicket } from "@/features/ticket/sign";
import { EventTicketEmail, eventTicketSubject } from "@/emails/event-ticket";
import { getDb } from "@/lib/db";
import { getEventBySlug } from "@/lib/events/registry";
import type { EventSummary } from "@/lib/events/types";
import { FROM_EMAIL, resend } from "@/lib/email";
import { defaultLocale } from "@/lib/i18n/config";

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
};

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
  const view = buildEventTicketView(input.registration, input.user, event);
  const ticketUrl = makeEventTicketUrl(input.registration.id, {
    locale: input.registration.locale,
  });

  if (!resend) {
    return { ticketUrl };
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
    return { ticketUrl };
  }

  const qrCid = "event-ticket-qr";
  const qrBuffer = await generateTicketQrPng(ticketUrl);

  await resend.emails.send({
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

  // Log after a successful send. The unique (registration, kind) index makes a
  // concurrent double-insert a no-op, so exactly one `confirmation` row exists.
  await db
    .insert(eventEmailLog)
    .values({ eventRegistrationId: input.registration.id, kind: "confirmation", status: "sent" })
    .onConflictDoNothing();

  return { ticketUrl };
}
