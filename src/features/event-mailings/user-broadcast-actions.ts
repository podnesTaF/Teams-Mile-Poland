"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { adminPath, requireAdmin, safeLocale } from "@/features/admin/action-helpers";

import { resendUserBroadcast, sendUserBroadcast } from "./user-broadcast";
import { parseUserSegment } from "./user-segments";

function back(locale: string, msg: string): never {
  const path = adminPath(locale, "/mailings");
  revalidatePath(path);
  redirect(`${path}?msg=${encodeURIComponent(msg)}`);
}

export async function sendUserBroadcastAction(formData: FormData) {
  const locale = safeLocale(formData.get("locale"));
  await requireAdmin(locale, "edit");

  const subject = String(formData.get("subject") ?? "").trim();
  const bodyHtml = String(formData.get("body") ?? "").trim();
  // Awaited, not just typed: `parseUserSegment` reads the event list from the DB
  // now. Left un-awaited, `segment` is a truthy Promise and the `!segment` gate
  // below — the tamper guard against a hand-posted segment value — never fires.
  const segment = await parseUserSegment(String(formData.get("segment") ?? ""));

  if (!subject || !bodyHtml) {
    back(locale, "Subject and message are required.");
  }
  if (!segment) {
    back(locale, "Unknown audience segment.");
  }

  const r = await sendUserBroadcast(subject, bodyHtml, segment);
  back(
    locale,
    `User broadcast: ${r.sent} sent, ${r.skipped} skipped, ${r.failed} failed (of ${r.total}).`,
  );
}

export async function resendUserBroadcastAction(formData: FormData) {
  const locale = safeLocale(formData.get("locale"));
  await requireAdmin(locale, "edit");

  const broadcastId = String(formData.get("broadcastId") ?? "").trim();
  if (!broadcastId) {
    back(locale, "Missing broadcast.");
  }

  const r = await resendUserBroadcast(broadcastId);
  if ("refused" in r) {
    back(
      locale,
      r.refused === "notfound"
        ? "Broadcast not found."
        : "Nothing was sent — this broadcast was written for an event that can no longer be identified, so its audience cannot be rebuilt. Send a new broadcast to a segment that still exists.",
    );
  }
  back(
    locale,
    `Re-send: ${r.sent} sent, ${r.skipped} skipped, ${r.failed} failed (of ${r.total}).`,
  );
}
