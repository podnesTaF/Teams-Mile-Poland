import { and, eq, inArray } from "drizzle-orm";

import { eventEmailLog } from "@/db/schema";
import { eventFooterMeta } from "@/emails/components";
import { EventMediaLiveEmail } from "@/emails/event-media-live";
import { getAppUrl } from "@/features/registration/data";
import { getDb } from "@/lib/db";
import { FROM_EMAIL, resend } from "@/lib/email";
import { getEventBySlug } from "@/lib/events/registry";
import { defaultLocale } from "@/lib/i18n/config";

import { eligibleForEvent } from "./audience";
import { mediaLiveMailContent, type MailLocale } from "./copy";

/** The manual, admin-triggered mailing kind — never sent by the cron chain. */
const MEDIA_LIVE_KIND = "media_live" as const;

export type MediaLiveSummary = {
  eventSlug: string;
  eligible: number;
  sent: number;
  skipped: number;
  failed: number;
};

/** Thrown when the event isn't a completed individual event with published media. */
export class MediaLiveNotEligibleError extends Error {}

/** Absolute, locale-aware URL of the event's public gallery page (the CTA target). */
function galleryUrl(slug: string, locale: MailLocale): string {
  const prefix = locale === defaultLocale ? "" : `/${locale}`;
  return `${getAppUrl()}${prefix}/events/${encodeURIComponent(slug)}/gallery`;
}

/** Registration ids that already received the media-live mailing (success only). */
async function alreadySent(registrationIds: string[]): Promise<Set<string>> {
  if (registrationIds.length === 0) return new Set();
  const rows = await getDb()
    .select({ id: eventEmailLog.eventRegistrationId })
    .from(eventEmailLog)
    .where(
      and(
        eq(eventEmailLog.kind, MEDIA_LIVE_KIND),
        eq(eventEmailLog.status, "sent"),
        inArray(eventEmailLog.eventRegistrationId, registrationIds),
      ),
    );
  return new Set(rows.map((r) => r.id));
}

/**
 * Send the one-per-event "your photos are live" mailing to an event's eligible
 * registrations (PRD #14, slice #18). Guards the event is a completed individual
 * event with `media` published — throwing {@link MediaLiveNotEligibleError}
 * otherwise, so a stale button or a hand-crafted call can never mail a
 * non-published event. Logged idempotently per `(event_registration_id,
 * 'media_live')`, so retries and double-clicks re-send to nobody. Callers must
 * enforce the admin gate (see `media-live-actions.ts`).
 */
export async function sendMediaLiveMailing(eventSlug: string): Promise<MediaLiveSummary> {
  const event = getEventBySlug(eventSlug);
  if (
    !event ||
    event.eventType !== "individual" ||
    event.status !== "completed" ||
    !event.media
  ) {
    throw new MediaLiveNotEligibleError(
      "This event isn't a completed event with published media.",
    );
  }

  const recipients = await eligibleForEvent(eventSlug);
  const summary: MediaLiveSummary = {
    eventSlug,
    eligible: recipients.length,
    sent: 0,
    skipped: 0,
    failed: 0,
  };

  if (!resend) {
    summary.skipped = recipients.length;
    return summary;
  }

  const done = await alreadySent(recipients.map((r) => r.registrationId));
  const db = getDb();

  for (const r of recipients) {
    if (done.has(r.registrationId)) {
      summary.skipped += 1;
      continue;
    }
    const content = mediaLiveMailContent(r.locale, r.fullName);
    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: r.email,
        subject: content.title,
        react: EventMediaLiveEmail({
          locale: r.locale,
          fullName: r.fullName,
          eventName: event.name,
          galleryUrl: galleryUrl(eventSlug, r.locale),
          footerMeta: eventFooterMeta(event),
        }),
      });
      await db
        .insert(eventEmailLog)
        .values({ eventRegistrationId: r.registrationId, kind: MEDIA_LIVE_KIND, status: "sent" })
        .onConflictDoNothing();
      summary.sent += 1;
    } catch {
      summary.failed += 1;
    }
  }

  return summary;
}
