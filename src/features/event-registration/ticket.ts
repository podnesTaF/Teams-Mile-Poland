import { getAppUrl } from "@/features/registration/data";
import { generateTicketQrPng } from "@/features/ticket/qr";
import { signEventTicket } from "@/features/ticket/sign";
import { EventTicketEmail, eventTicketSubject } from "@/emails/event-ticket";
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

/** Send the confirmation email with an embedded, scannable QR ticket. */
export async function sendEventTicketEmail(input: {
  registration: EventRegistrationRow;
  user: TicketUser;
}) {
  const event = getEventBySlug(input.registration.eventSlug);
  const view = buildEventTicketView(input.registration, input.user, event);
  const ticketUrl = makeEventTicketUrl(input.registration.id, { locale: input.registration.locale });

  if (!resend) {
    return { ticketUrl };
  }

  const qrCid = "event-ticket-qr";
  const qrBuffer = await generateTicketQrPng(ticketUrl);

  await resend.emails.send({
    from: FROM_EMAIL,
    to: view.email,
    subject: eventTicketSubject(view),
    react: EventTicketEmail({ view, ticketUrl, qrCid }),
    attachments: [{ filename: "ticket-qr.png", content: qrBuffer, contentId: qrCid }],
  });

  return { ticketUrl };
}
