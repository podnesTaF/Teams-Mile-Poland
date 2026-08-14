"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { adminPath, requireAdmin, safeLocale } from "@/features/admin/action-helpers";

import { MediaLiveNotEligibleError, sendMediaLiveMailing } from "./media-live";

/**
 * Admin-gated entry point for the "send photos-live email" button on the admin
 * event page. Sends the media-live mailing, then redirects back to the event's
 * admin page with a counts message (the `?msg=` notice the page already
 * renders). The send itself is idempotent, so a double-submit mails nobody.
 */
export async function sendMediaLiveMailingAction(formData: FormData) {
  const locale = safeLocale(formData.get("locale"));
  await requireAdmin(locale, "edit");

  const slug = String(formData.get("slug") ?? "").trim();
  const path = adminPath(locale, `/events/${slug}`);

  let msg: string;
  try {
    const r = await sendMediaLiveMailing(slug);
    msg = `Photos-live email: ${r.sent} sent, ${r.skipped} skipped, ${r.failed} failed (of ${r.eligible} eligible).`;
  } catch (e) {
    msg =
      e instanceof MediaLiveNotEligibleError
        ? e.message
        : "Could not send the photos-live email.";
  }

  revalidatePath(path);
  redirect(`${path}?msg=${encodeURIComponent(msg)}`);
}
