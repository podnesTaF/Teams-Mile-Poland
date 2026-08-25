"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { adminPath, requireAdmin, safeLocale } from "@/features/admin/action-helpers";
import { getEventBySlug } from "@/lib/events/registry";

import { runDueEventMailings, sendEventKind } from "./dispatch";
import { EVENT_SCHEDULED_KINDS, type EventScheduledKind } from "./schedule";

/**
 * The lifecycle states a scheduled event mail may be sent for.
 *
 * An allow-list, not a `cancelled`/`draft` deny-list, so a status added later has
 * to opt in rather than inherit permission to mail. Every kind in
 * `EVENT_SCHEDULED_KINDS` is a *pre-race* mail ("in 7 days", "tomorrow", "this
 * morning"), so it is only ever true for a night that is announced and still
 * going to happen:
 *
 * - `draft` — nobody has been told this night exists; mailing about it announces
 *   it, from a page that 404s.
 * - `cancelled` — the worst failure mode in this feature: "see you tomorrow" for
 *   a race that is off.
 * - `completed` — the night has run; every one of these sentences is now false.
 *   The admin UI already cannot offer this (the mailings page is built from
 *   `getSeriesEvents`, which drops completed events), so refusing it here just
 *   makes the action agree with the page it is posted from.
 */
const MAILABLE_STATUSES = ["upcoming", "registration_open", "registration_closed"] as const;

function back(locale: string, msg: string): never {
  const path = adminPath(locale, "/mailings");
  revalidatePath(path);
  redirect(`${path}?msg=${encodeURIComponent(msg)}`);
}

export async function runDueEventMailingsAction(formData: FormData) {
  const locale = safeLocale(formData.get("locale"));
  await requireAdmin(locale, "edit");
  const summaries = await runDueEventMailings(new Date());
  const msg = summaries.length
    ? summaries
        .map(
          (s) =>
            `${s.eventSlug}/${s.kind}: ${s.sent} sent, ${s.skipped} skipped, ${s.failed} failed`,
        )
        .join(" · ")
    : "Nothing due for series events right now.";
  back(locale, msg);
}

export async function sendEventKindNowAction(formData: FormData) {
  const locale = safeLocale(formData.get("locale"));
  await requireAdmin(locale, "edit");

  const slug = String(formData.get("eventSlug") ?? "").trim();
  const kind = String(formData.get("kind") ?? "") as EventScheduledKind;
  const event = await getEventBySlug(slug);

  if (!event || event.eventType !== "individual") {
    back(locale, "Unknown event.");
  }
  // Status is checked here and not only in the UI: a cancelled event drops off
  // the mailings page, but the form that was rendered before it was cancelled
  // still posts — a stale tab, or a back-and-resubmit, is enough to mail a race
  // that is off. See {@link MAILABLE_STATUSES}.
  if (!(MAILABLE_STATUSES as readonly string[]).includes(event.status)) {
    back(locale, `Nothing sent: this event is ${event.status}, which cannot be mailed about.`);
  }
  if (!(EVENT_SCHEDULED_KINDS as readonly string[]).includes(kind)) {
    back(locale, "Unknown email kind.");
  }

  const s = await sendEventKind(event, kind);
  back(
    locale,
    `${event.shortDate} / ${s.kind}: ${s.sent} sent, ${s.skipped} skipped, ${s.failed} failed (of ${s.eligible}).`,
  );
}
