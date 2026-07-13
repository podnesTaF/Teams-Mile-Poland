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
  await requireAdmin(locale);

  const subject = String(formData.get("subject") ?? "").trim();
  const bodyHtml = String(formData.get("body") ?? "").trim();
  const segment = parseUserSegment(String(formData.get("segment") ?? ""));

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
  await requireAdmin(locale);

  const broadcastId = String(formData.get("broadcastId") ?? "").trim();
  if (!broadcastId) {
    back(locale, "Missing broadcast.");
  }

  const r = await resendUserBroadcast(broadcastId);
  if (!r) {
    back(locale, "Broadcast not found.");
  }
  back(
    locale,
    `Re-send: ${r.sent} sent, ${r.skipped} skipped, ${r.failed} failed (of ${r.total}).`,
  );
}
