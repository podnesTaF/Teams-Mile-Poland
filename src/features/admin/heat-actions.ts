"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { getBibPool, getEventBySlug } from "@/lib/events/registry";

import { adminPath, requireAdmin, safeLocale } from "./action-helpers";
import { warsawLocalToInstant } from "./heat-time";
import {
  createHeats,
  deleteHeatRow,
  heatBelongsToEvent,
  MAX_GENERATE_HEATS,
  setHeatForRegistrations,
  updateHeatRow,
} from "./heats-data";

function heatsPath(locale: string, slug: string, query = "") {
  return adminPath(locale, `/events/${slug}/heats${query}`);
}

/** Redirect back to the builder with an `ok=` / `error=` flash code. */
function back(locale: string, slug: string, params: string): never {
  redirect(heatsPath(locale, slug, `?${params}`));
}

function revalidateBuilder(locale: string, slug: string) {
  revalidatePath(heatsPath(locale, slug));
  revalidatePath(adminPath(locale, `/events/${slug}`));
}

function readInt(formData: FormData, key: string): number | null {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isInteger(n) ? n : null;
}

/**
 * Generate N heats for an event, spaced `intervalMinutes` apart from
 * `firstStart` (a Warsaw wall-clock `datetime-local` value). Numbering continues
 * from the event's existing heats.
 *
 * Capacity is hard-capped at the event's bib pool: a heat the timing system
 * cannot chip is not a heat (ADR 0003).
 */
export async function generateHeats(formData: FormData) {
  const locale = safeLocale(formData.get("locale"));
  await requireAdmin(locale);

  const slug = String(formData.get("slug") ?? "");
  const event = getEventBySlug(slug);
  if (!event || event.eventType !== "individual") {
    back(locale, slug, "error=input");
  }

  const count = readInt(formData, "count");
  const capacity = readInt(formData, "capacity");
  const intervalMinutes = readInt(formData, "intervalMinutes");
  const firstStart = warsawLocalToInstant(String(formData.get("firstStart") ?? ""));
  const pool = getBibPool(slug);

  if (count === null || count < 1 || count > MAX_GENERATE_HEATS) {
    back(locale, slug, "error=count");
  }
  if (capacity === null || capacity < 1 || capacity > pool) {
    back(locale, slug, "error=capacity");
  }
  if (intervalMinutes === null || intervalMinutes < 1) {
    back(locale, slug, "error=interval");
  }
  if (!firstStart) {
    back(locale, slug, "error=time");
  }

  await createHeats(slug, { count, capacity, firstStart, intervalMinutes });
  revalidateBuilder(locale, slug);
  back(locale, slug, `ok=generated&n=${count}`);
}

/**
 * Edit one heat's capacity and/or start time. Out-of-order times are allowed —
 * the builder warns about them instead, so a card can be reordered in whatever
 * sequence of edits the admin finds convenient.
 */
export async function updateHeat(formData: FormData) {
  const locale = safeLocale(formData.get("locale"));
  await requireAdmin(locale);

  const slug = String(formData.get("slug") ?? "");
  const heatId = String(formData.get("heatId") ?? "");
  if (!slug || !heatId) {
    back(locale, slug, "error=input");
  }

  const capacity = readInt(formData, "capacity");
  const pool = getBibPool(slug);
  if (capacity !== null && (capacity < 1 || capacity > pool)) {
    back(locale, slug, "error=capacity");
  }

  const scheduledRaw = String(formData.get("scheduledAt") ?? "").trim();
  const scheduledAt = scheduledRaw ? warsawLocalToInstant(scheduledRaw) : null;
  if (scheduledRaw && !scheduledAt) {
    back(locale, slug, "error=time");
  }

  const result = await updateHeatRow(slug, heatId, {
    ...(capacity !== null ? { capacity } : {}),
    ...(scheduledAt ? { scheduledAt } : {}),
  });
  if (result === "missing") {
    back(locale, slug, "error=missing");
  }
  if (result === "nothing-to-do") {
    back(locale, slug, "error=nochange");
  }

  revalidateBuilder(locale, slug);
  back(locale, slug, "ok=updated");
}

/** Delete a heat; its members fall back into the Unassigned list. */
export async function deleteHeat(formData: FormData) {
  const locale = safeLocale(formData.get("locale"));
  await requireAdmin(locale);

  const slug = String(formData.get("slug") ?? "");
  const heatId = String(formData.get("heatId") ?? "");
  if (!slug || !heatId) {
    back(locale, slug, "error=input");
  }

  const deleted = await deleteHeatRow(slug, heatId);
  revalidateBuilder(locale, slug);
  back(locale, slug, deleted ? "ok=deleted" : "error=missing");
}

/** The selected registration ids carried by the builder's bulk-move form. */
function selectedIds(formData: FormData): string[] {
  return formData
    .getAll("registrationIds")
    .map((v) => String(v))
    .filter(Boolean);
}

/** Bulk-move the selected registrations into one heat. */
export async function assignToHeat(formData: FormData) {
  const locale = safeLocale(formData.get("locale"));
  await requireAdmin(locale);

  const slug = String(formData.get("slug") ?? "");
  const heatId = String(formData.get("heatId") ?? "");
  const ids = selectedIds(formData);
  if (!slug) {
    back(locale, slug, "error=input");
  }
  if (ids.length === 0) {
    back(locale, slug, "error=noselection");
  }
  if (!heatId || !(await heatBelongsToEvent(slug, heatId))) {
    back(locale, slug, "error=noheat");
  }

  const moved = await setHeatForRegistrations(slug, heatId, ids);
  revalidateBuilder(locale, slug);
  back(locale, slug, `ok=assigned&n=${moved}`);
}

/** Bulk-remove the selected registrations from whatever heat they are in. */
export async function unassignFromHeat(formData: FormData) {
  const locale = safeLocale(formData.get("locale"));
  await requireAdmin(locale);

  const slug = String(formData.get("slug") ?? "");
  const ids = selectedIds(formData);
  if (!slug) {
    back(locale, slug, "error=input");
  }
  if (ids.length === 0) {
    back(locale, slug, "error=noselection");
  }

  const moved = await setHeatForRegistrations(slug, null, ids);
  revalidateBuilder(locale, slug);
  back(locale, slug, `ok=unassigned&n=${moved}`);
}
