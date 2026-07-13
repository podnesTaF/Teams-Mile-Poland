"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { eventRegistrations } from "@/db/schema";
import { getDb } from "@/lib/db";

import { adminPath, requireAdmin, safeLocale } from "./action-helpers";

function rosterPath(locale: string, slug: string, query = "") {
  return adminPath(locale, `/events/${slug}${query}`);
}

/**
 * Remove a registration from an event roster — for duplicates and withdrawal
 * requests. Scoped to the event so a mismatched id is a no-op. The registration
 * row's `event_email_log` entries cascade with it. Confirm dialog upstream.
 */
export async function removeRegistration(formData: FormData) {
  const locale = safeLocale(formData.get("locale"));
  await requireAdmin(locale);
  const slug = String(formData.get("slug") ?? "");
  const registrationId = String(formData.get("registrationId") ?? "");
  const status = String(formData.get("status") ?? "");

  function back(msg: string): never {
    revalidatePath(rosterPath(locale, slug));
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    params.set("msg", msg);
    redirect(rosterPath(locale, slug, `?${params.toString()}`));
  }

  if (!slug || !registrationId) back("Missing registration.");

  await getDb()
    .delete(eventRegistrations)
    .where(and(eq(eventRegistrations.id, registrationId), eq(eventRegistrations.eventSlug, slug)));

  back("Registration removed.");
}
