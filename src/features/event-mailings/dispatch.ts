import { and, eq, inArray } from "drizzle-orm";

import { eventEmailLog } from "@/db/schema";
import { eventFooterMeta } from "@/emails/components";
import { EventLifecycleEmail, type EventWhenWhere } from "@/emails/event-lifecycle";
import { makeEventTicketUrl } from "@/features/event-registration/ticket";
import { getDb } from "@/lib/db";
import { resend, FROM_EMAIL } from "@/lib/email";
import { getSeriesEvents } from "@/lib/events/registry";
import type { EventSummary } from "@/lib/events/types";
import { EVENT } from "@/lib/marketing/event";

import { asksForConfirmation, eventMailContent, type MailLocale } from "./copy";
import { eligibleForEvent } from "./audience";
import { dueScheduledKind, type EventScheduledKind } from "./schedule";

export type EventKindSummary = {
  eventSlug: string;
  kind: EventScheduledKind;
  eligible: number;
  sent: number;
  skipped: number;
  failed: number;
};

/** Registration ids that already received a given kind (success only). */
async function alreadySent(
  kind: EventScheduledKind,
  registrationIds: string[],
): Promise<Set<string>> {
  if (registrationIds.length === 0) return new Set();
  const rows = await getDb()
    .select({ id: eventEmailLog.eventRegistrationId })
    .from(eventEmailLog)
    .where(
      and(
        eq(eventEmailLog.kind, kind),
        eq(eventEmailLog.status, "sent"),
        inArray(eventEmailLog.eventRegistrationId, registrationIds),
      ),
    );
  return new Set(rows.map((r) => r.id));
}

const CEST = "+02:00";
const TZ = "Europe/Warsaw";

/** Google "add to calendar" deep-link for a specific event + timeRange. */
function calendarUrl(event: EventSummary): string {
  const ymd = event.date.replace(/-/g, "");
  const start = (event.timeRange?.start ?? "09:00").replace(":", "") + "00";
  const end = (event.timeRange?.end ?? "12:00").replace(":", "") + "00";
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `${event.name} — ${event.shortDate}`,
    dates: `${ymd}T${start}/${ymd}T${end}`,
    ctz: TZ,
    details: "Individual mile race. Bring your QR ticket, sportswear and running shoes.",
    location: `${EVENT.venue.name}, ${EVENT.venue.address}, ${EVENT.venue.postal} ${EVENT.venue.city}, ${EVENT.venue.country}`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

const DATE_LOCALE: Record<MailLocale, string> = { ua: "uk-UA", pl: "pl-PL", en: "en-GB" };

function whenWhereFor(event: EventSummary, locale: MailLocale): EventWhenWhere {
  const date = new Intl.DateTimeFormat(DATE_LOCALE[locale], {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: TZ,
  }).format(new Date(`${event.date}T12:00:00${CEST}`));
  const time = event.timeRange ? `${event.timeRange.start} – ${event.timeRange.end}` : "";
  return {
    date,
    time,
    venue: `${EVENT.venue.name}, ${EVENT.venue.address}, ${event.city}`,
    contact: `${EVENT.contact.phone} · ${EVENT.contact.email}`,
  };
}

/** Send one lifecycle kind to every eligible participant of an event. */
export async function sendEventKind(
  event: EventSummary,
  kind: EventScheduledKind,
): Promise<EventKindSummary> {
  const recipients = await eligibleForEvent(event.slug);
  const summary: EventKindSummary = {
    eventSlug: event.slug,
    kind,
    eligible: recipients.length,
    sent: 0,
    skipped: 0,
    failed: 0,
  };

  if (!resend) {
    summary.skipped = recipients.length;
    return summary;
  }

  const done = await alreadySent(
    kind,
    recipients.map((r) => r.registrationId),
  );
  const db = getDb();
  const calendar = calendarUrl(event);

  for (const r of recipients) {
    if (done.has(r.registrationId)) {
      summary.skipped += 1;
      continue;
    }
    const content = eventMailContent(kind, r.locale, r.fullName);
    const ticket = makeEventTicketUrl(r.registrationId, { locale: r.locale });
    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: r.email,
        subject: content.title,
        react: EventLifecycleEmail({
          kind,
          locale: r.locale,
          fullName: r.fullName,
          urls: {
            calendar,
            ticket,
            map: EVENT.mapsUrl,
            confirm: `${ticket}#confirm`,
          },
          whenWhere: whenWhereFor(event, r.locale),
          footerMeta: eventFooterMeta(event),
          // Only the reminders ask, and only of someone who has not answered.
          showConfirm: asksForConfirmation(kind) && r.status === "registered",
        }),
      });
      await db
        .insert(eventEmailLog)
        .values({ eventRegistrationId: r.registrationId, kind, status: "sent" })
        .onConflictDoNothing();
      summary.sent += 1;
    } catch {
      summary.failed += 1;
    }
  }

  return summary;
}

/**
 * Run every due lifecycle email across the individual mile series. For each
 * non-completed series event, the single kind whose window contains `now` is
 * sent. Independent of the legacy team lifecycle (`mailings/dispatch.ts`).
 */
export async function runDueEventMailings(now: Date): Promise<EventKindSummary[]> {
  const summaries: EventKindSummary[] = [];
  for (const event of getSeriesEvents()) {
    const kind = dueScheduledKind(now, event);
    if (kind) {
      summaries.push(await sendEventKind(event, kind));
    }
  }
  return summaries;
}
