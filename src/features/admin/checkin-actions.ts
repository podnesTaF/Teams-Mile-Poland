"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { getAdminSession } from "@/lib/auth/admin-session";
import { defaultLocale, locales } from "@/lib/i18n/config";

import {
  checkInWithBib,
  isUniqueViolation,
  setRegistrationStatus,
  suggestNextBib,
} from "./events-data";

function safeLocale(value: FormDataEntryValue | null) {
  const v = typeof value === "string" ? value : "";
  return (locales as readonly string[]).includes(v) ? v : defaultLocale;
}

function checkinPath(locale: string, slug: string, query = "") {
  const prefix = locale === defaultLocale ? "" : `/${locale}`;
  return `${prefix}/admin/events/${slug}/checkin${query}`;
}

function eventPath(locale: string, slug: string) {
  const prefix = locale === defaultLocale ? "" : `/${locale}`;
  return `${prefix}/admin/events/${slug}`;
}

async function requireAdmin(locale: string) {
  if (!(await getAdminSession())) {
    redirect(`${locale === defaultLocale ? "" : `/${locale}`}/admin/login`);
  }
}

/**
 * Assign a bib and check a runner in. If a bib is supplied it's used verbatim
 * (unique-violation → "bib taken"); if blank, the next suggested bib is used
 * with a short retry loop to absorb concurrent assignments.
 */
export async function assignBibAndCheckIn(formData: FormData) {
  const locale = safeLocale(formData.get("locale"));
  await requireAdmin(locale);

  const slug = String(formData.get("slug") ?? "");
  const registrationId = String(formData.get("registrationId") ?? "");
  const bibRaw = String(formData.get("bib") ?? "").trim();
  const q = String(formData.get("q") ?? "");
  const backQuery = q ? `?q=${encodeURIComponent(q)}` : "";

  if (!slug || !registrationId) {
    redirect(checkinPath(locale, slug, `${backQuery}${backQuery ? "&" : "?"}error=input`));
  }

  // Explicit bib: one attempt, surface conflicts.
  if (bibRaw) {
    const bib = Number.parseInt(bibRaw, 10);
    if (!Number.isInteger(bib) || bib < 1) {
      redirect(checkinPath(locale, slug, `${backQuery}${backQuery ? "&" : "?"}error=bib`));
    }
    try {
      await checkInWithBib(registrationId, bib);
    } catch (error) {
      if (isUniqueViolation(error)) {
        redirect(checkinPath(locale, slug, `${backQuery}${backQuery ? "&" : "?"}error=bib_taken`));
      }
      throw error;
    }
    revalidatePath(checkinPath(locale, slug));
    revalidatePath(eventPath(locale, slug));
    redirect(checkinPath(locale, slug, `${backQuery}${backQuery ? "&" : "?"}ok=${bib}`));
  }

  // Auto-assign: retry on the (rare) race where the suggested bib is taken.
  let assigned: number | null = null;
  for (let attempt = 0; attempt < 5 && assigned === null; attempt += 1) {
    const bib = await suggestNextBib(slug);
    try {
      await checkInWithBib(registrationId, bib);
      assigned = bib;
    } catch (error) {
      if (isUniqueViolation(error)) continue;
      throw error;
    }
  }

  if (assigned === null) {
    redirect(checkinPath(locale, slug, `${backQuery}${backQuery ? "&" : "?"}error=bib_taken`));
  }

  revalidatePath(checkinPath(locale, slug));
  revalidatePath(eventPath(locale, slug));
  redirect(checkinPath(locale, slug, `${backQuery}${backQuery ? "&" : "?"}ok=${assigned}`));
}

/** Mark a runner a no-show. */
export async function markNoShow(formData: FormData) {
  const locale = safeLocale(formData.get("locale"));
  await requireAdmin(locale);
  const slug = String(formData.get("slug") ?? "");
  const registrationId = String(formData.get("registrationId") ?? "");
  if (slug && registrationId) {
    await setRegistrationStatus(registrationId, "no_show");
    revalidatePath(checkinPath(locale, slug));
    revalidatePath(eventPath(locale, slug));
  }
}

/** Revert a runner back to registered (undo check-in / no-show). */
export async function revertToRegistered(formData: FormData) {
  const locale = safeLocale(formData.get("locale"));
  await requireAdmin(locale);
  const slug = String(formData.get("slug") ?? "");
  const registrationId = String(formData.get("registrationId") ?? "");
  if (slug && registrationId) {
    await setRegistrationStatus(registrationId, "registered");
    revalidatePath(checkinPath(locale, slug));
    revalidatePath(eventPath(locale, slug));
  }
}
