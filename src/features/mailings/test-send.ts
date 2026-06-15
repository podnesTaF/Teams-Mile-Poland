import { eq, inArray } from "drizzle-orm";

import { runners, teams } from "@/db/schema";
import { getDb } from "@/lib/db";
import { resend, FROM_EMAIL } from "@/lib/email";
import { EVENT } from "@/lib/marketing/event";
import { createMagicLink, makeInviteUrl } from "@/features/registration/data";
import { generateTicketQrPng, makeTicketUrl, type TicketView } from "@/features/ticket";
import { googleCalendarUrl } from "@/lib/calendar";
import { LifecycleEmail, type LifecycleUrls } from "@/emails/lifecycle";
import { lifecycleContent, type LifecycleKind, type MailLocale } from "@/emails/lifecycle/copy";
import { RegistrationTicketEmail, subjectForFlow } from "@/emails/registration-ticket";

/**
 * Templates that can be test-sent from the admin Mailings page. Lifecycle kinds
 * reuse the real `LifecycleEmail`; the two registration kinds render the real
 * `RegistrationTicketEmail` for the captain ("start") and solo ("free") flows.
 */
export type TestKind = LifecycleKind | "registration_solo" | "registration_team";

export const TEST_EMAIL_OPTIONS: { value: TestKind; label: string }[] = [
  { value: "reminder_14d", label: "−14 days · light reminder" },
  { value: "reminder_7d", label: "−7 days · logistics" },
  { value: "reminder_3d", label: "−3 days · checklist" },
  { value: "reminder_1d", label: "−1 day · practical" },
  { value: "morning", label: "Morning of · go!" },
  { value: "captain_incomplete", label: "Captain reminder · incomplete team" },
  { value: "registration_solo", label: "Registration confirmation · solo / free agent" },
  { value: "registration_team", label: "Registration confirmation · team captain" },
];

const TEST_KINDS = new Set<string>(TEST_EMAIL_OPTIONS.map((o) => o.value));
export function isTestKind(value: string): value is TestKind {
  return TEST_KINDS.has(value);
}

const LIFECYCLE_KINDS = new Set<string>([
  "reminder_14d",
  "reminder_7d",
  "reminder_3d",
  "reminder_1d",
  "morning",
  "captain_incomplete",
]);
function isLifecycleKind(kind: TestKind): kind is LifecycleKind {
  return LIFECYCLE_KINDS.has(kind);
}

type TestRecipient = {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  locale: MailLocale;
  teamId: string | null;
  teamCode: string | null;
  teamName: string | null;
};

function asMailLocale(value: string): MailLocale {
  return value === "pl" || value === "en" || value === "ua" ? value : "ua";
}

async function fetchRecipients(ids: string[]): Promise<TestRecipient[]> {
  if (ids.length === 0) return [];
  const rows = await getDb()
    .select({
      id: runners.id,
      email: runners.email,
      fullName: runners.fullName,
      phone: runners.phone,
      locale: runners.locale,
      teamId: runners.teamId,
      teamCode: teams.code,
      teamName: teams.name,
    })
    .from(runners)
    .leftJoin(teams, eq(runners.teamId, teams.id))
    .where(inArray(runners.id, ids));
  return rows.map((r) => ({ ...r, locale: asMailLocale(r.locale) }));
}

function lifecycleUrls(r: TestRecipient): LifecycleUrls {
  return {
    calendar: googleCalendarUrl(),
    ticket: makeTicketUrl(r.id, { locale: r.locale }),
    map: EVENT.mapsUrl,
    invite: r.teamCode ? makeInviteUrl(r.teamCode) : undefined,
  };
}

export type TestSendResult = { total: number; sent: number; failed: number };

/**
 * Render the chosen template with each selected runner's real data and email it
 * to them. Test sends are intentionally NOT written to `email_log`, so they
 * never count toward (or get skipped by) the real lifecycle dedup.
 */
export async function sendTestEmail(kind: TestKind, runnerIds: string[]): Promise<TestSendResult> {
  const recipients = await fetchRecipients(runnerIds);
  const result: TestSendResult = { total: recipients.length, sent: 0, failed: 0 };
  if (!resend) return result;

  for (const r of recipients) {
    try {
      if (isLifecycleKind(kind)) {
        // captain_incomplete copy needs a "still to register" count; use a sample.
        const ctx = {
          fullName: r.fullName,
          teamName: r.teamName,
          remaining: kind === "captain_incomplete" ? 3 : undefined,
        };
        await resend.emails.send({
          from: FROM_EMAIL,
          to: r.email,
          subject: `[TEST] ${lifecycleContent(kind, r.locale, ctx).title}`,
          react: LifecycleEmail({ kind, locale: r.locale, ctx, urls: lifecycleUrls(r) }),
        });
      } else {
        await sendRegistrationTest(kind, r);
      }
      result.sent += 1;
    } catch {
      result.failed += 1;
    }
  }

  return result;
}

const QR_CID = "ticket-qr";

async function sendRegistrationTest(
  kind: "registration_solo" | "registration_team",
  r: TestRecipient,
): Promise<void> {
  const flow = kind === "registration_team" ? "start" : "free";
  const ticket: TicketView = {
    runnerId: r.id,
    fullName: r.fullName,
    email: r.email,
    phone: r.phone,
    teamCode: r.teamCode ?? undefined,
    teamName: r.teamName ?? undefined,
    flow,
    paymentStatus: kind === "registration_team" ? "paid" : "free",
    eventName: EVENT.name,
    eventDateLabel: EVENT.dateLabel.en,
    eventVenue: `${EVENT.venue.name}, ${EVENT.venue.city}`,
  };

  const magicUrl = await createMagicLink({
    email: r.email,
    runnerId: r.id,
    teamId: r.teamId ?? undefined,
  });
  const ticketUrl = makeTicketUrl(r.id, { locale: "en" });
  const qrBuffer = await generateTicketQrPng(ticketUrl);
  const inviteUrl = flow === "start" && r.teamCode ? makeInviteUrl(r.teamCode) : undefined;

  await resend!.emails.send({
    from: FROM_EMAIL,
    to: r.email,
    subject: `[TEST] ${subjectForFlow(ticket)}`,
    react: RegistrationTicketEmail({ ticket, magicUrl, ticketUrl, inviteUrl, qrCid: QR_CID }),
    attachments: [{ filename: "ticket-qr.png", content: qrBuffer, contentId: QR_CID }],
  });
}
