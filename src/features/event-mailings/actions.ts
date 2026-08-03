"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { adminPath, requireAdmin, safeLocale } from "@/features/admin/action-helpers";
import { getEventBySlug } from "@/lib/events/registry";

import { runDueEventMailings, sendEventKind } from "./dispatch";
import { EVENT_SCHEDULED_KINDS, type EventScheduledKind } from "./schedule";

function back(locale: string, msg: string): never {
  const path = adminPath(locale, "/mailings");
  revalidatePath(path);
  redirect(`${path}?msg=${encodeURIComponent(msg)}`);
}

export async function runDueEventMailingsAction(formData: FormData) {
  const locale = safeLocale(formData.get("locale"));
  await requireAdmin(locale);
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
  await requireAdmin(locale);

  const slug = String(formData.get("eventSlug") ?? "").trim();
  const kind = String(formData.get("kind") ?? "") as EventScheduledKind;
  const event = getEventBySlug(slug);

  if (!event || event.eventType !== "individual") {
    back(locale, "Unknown event.");
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
