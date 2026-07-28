"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { getBibPool } from "@/lib/events/registry";

import { adminPath, requireAdmin, safeLocale } from "./action-helpers";
import {
  checkInWithBib,
  checkInWithoutBib,
  isUniqueViolation,
  setRegistrationStatus,
  suggestNextBib,
} from "./events-data";

function checkinPath(locale: string, slug: string, query = "") {
  return adminPath(locale, `/events/${slug}/checkin${query}`);
}

function eventPath(locale: string, slug: string) {
  return adminPath(locale, `/events/${slug}`);
}

/**
 * Lease a bib and check a runner in. If a bib is supplied it's used verbatim
 * (unique-violation → "bib held"); if blank, the lowest free bib in the pool is
 * leased, with a short retry loop to absorb a concurrent desk taking it first.
 *
 * An exhausted pool is not a failure (ADR 0003): the runner is checked in
 * bib-less and the desk is told to free numbers by marking a finished heat
 * complete.
 */
export async function assignBibAndCheckIn(formData: FormData) {
  const locale = safeLocale(formData.get("locale"));
  await requireAdmin(locale);

  const slug = String(formData.get("slug") ?? "");
  const registrationId = String(formData.get("registrationId") ?? "");
  const bibRaw = String(formData.get("bib") ?? "").trim();
  const q = String(formData.get("q") ?? "");
  const backQuery = q ? `?q=${encodeURIComponent(q)}` : "";
  const back = (params: string) =>
    checkinPath(locale, slug, `${backQuery}${backQuery ? "&" : "?"}${params}`);

  if (!slug || !registrationId) {
    redirect(back("error=input"));
  }

  // Explicit bib: one attempt, surface conflicts.
  if (bibRaw) {
    const bib = Number.parseInt(bibRaw, 10);
    if (!Number.isInteger(bib) || bib < 1 || bib > getBibPool(slug)) {
      redirect(back("error=bib"));
    }
    try {
      await checkInWithBib(registrationId, bib);
    } catch (error) {
      if (isUniqueViolation(error)) {
        redirect(back("error=bib_held"));
      }
      throw error;
    }
    revalidatePath(checkinPath(locale, slug));
    revalidatePath(eventPath(locale, slug));
    redirect(back(`ok=${bib}`));
  }

  // Auto-lease: retry on the (rare) race where the suggested bib is taken
  // between suggestion and update.
  let assigned: number | null = null;
  let exhausted = false;
  for (let attempt = 0; attempt < 5 && assigned === null && !exhausted; attempt += 1) {
    const bib = await suggestNextBib(slug);
    if (bib === null) {
      exhausted = true;
      break;
    }
    try {
      await checkInWithBib(registrationId, bib);
      assigned = bib;
    } catch (error) {
      if (isUniqueViolation(error)) continue;
      throw error;
    }
  }

  // Lost five suggestions in a row to other desks while bibs were still free —
  // a genuine race, distinct from exhaustion.
  if (assigned === null && !exhausted) {
    redirect(back("error=bib_race"));
  }

  if (assigned === null) {
    await checkInWithoutBib(registrationId);
  }

  revalidatePath(checkinPath(locale, slug));
  revalidatePath(eventPath(locale, slug));
  redirect(back(assigned === null ? "ok=pending" : `ok=${assigned}`));
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
