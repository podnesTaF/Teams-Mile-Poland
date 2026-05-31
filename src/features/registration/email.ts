import { RegistrationTicketEmail, subjectForFlow } from "@/emails/registration-ticket";
import { FROM_EMAIL, resend } from "@/lib/email";
import { EVENT } from "@/lib/marketing/event";
import {
  generateTicketQrPng,
  makeTicketUrl,
  type TicketView,
} from "@/features/ticket";

import { createMagicLink, makeInviteUrl, type StoredRegistration } from "./data";

const QR_CID = "ticket-qr";

type EmailInput = {
  stored: StoredRegistration;
  dashboardPath?: string;
};

export async function sendRegistrationEmails({ stored, dashboardPath }: EmailInput) {
  const magicUrl = await createMagicLink({
    email: stored.runnerEmail,
    runnerId: stored.runnerId,
    teamId: stored.teamId,
    path: dashboardPath,
  });

  if (!resend) {
    return { magicUrl };
  }

  const ticket = buildTicketView(stored);
  const ticketUrl = makeTicketUrl(stored.runnerId, { locale: "en" });
  const qrBuffer = await generateTicketQrPng(ticketUrl);
  const inviteUrl =
    stored.flow === "start" && stored.teamCode ? makeInviteUrl(stored.teamCode) : undefined;

  await resend.emails.send({
    from: FROM_EMAIL,
    to: stored.runnerEmail,
    subject: subjectForFlow(ticket),
    react: RegistrationTicketEmail({ ticket, magicUrl, ticketUrl, inviteUrl, qrCid: QR_CID }),
    attachments: [
      {
        filename: "ticket-qr.png",
        content: qrBuffer,
        contentId: QR_CID,
      },
    ],
  });

  if (stored.flow === "join" && stored.captainEmail) {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: stored.captainEmail,
      subject: "A runner joined your TEAMS MILE squad",
      text: `A new runner joined your team ${stored.teamCode ?? ""}.\n\nOpen your dashboard: ${magicUrl}`,
    });
  }

  return { magicUrl };
}

function buildTicketView(stored: StoredRegistration): TicketView {
  return {
    runnerId: stored.runnerId,
    fullName: stored.fullName,
    email: stored.runnerEmail,
    phone: stored.phone,
    teamCode: stored.teamCode,
    teamName: stored.teamName,
    flow: stored.flow,
    paymentStatus: stored.paymentStatus,
    eventName: EVENT.name,
    eventDateLabel: EVENT.dateLabel.en,
    eventVenue: `${EVENT.venue.name}, ${EVENT.venue.city}`,
  };
}
