"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { revalidateStartList } from "@/features/event-heats/start-list";
import {
  HeatPublishNotEligibleError,
  publishHeatsAndNotify,
  type PublishHeatsSummary,
} from "@/features/event-mailings/heat-assignment";
import { warsawLocalToInstant } from "@/lib/events/heat-time";
import { getBibPool, getEventBySlug } from "@/lib/events/registry";

import { adminPath, requireAdmin, safeLocale } from "./action-helpers";
import {
  createHeats,
  deleteHeatRow,
  heatBelongsToEvent,
  MAX_GENERATE_HEATS,
  setHeatForRegistrations,
  updateHeatRow,
} from "./heats-data";
import { seedTopQualifiers } from "./results-import/data";

function heatsPath(locale: string, slug: string, query = "") {
  return adminPath(locale, `/events/${slug}/heats${query}`);
}

/** Redirect back to the builder with an `ok=` / `error=` flash code. */
function back(locale: string, slug: string, params: string): never {
  redirect(heatsPath(locale, slug, `?${params}`));
}

/**
 * Invalidate every surface a heat mutation can change: the builder, the admin
 * event page — and the public start list, which is server-rendered once and then
 * cached until something tells it to re-render.
 *
 * Every heat action goes through here, including generate: a card's first draft
 * heat flips the public page from its empty state to "not published yet", which
 * is a visible change even though no heat is released yet. Check-in deliberately
 * does *not* revalidate the start list — no bib is displayed there, so nothing on
 * that page depends on it (PRD #26).
 */
function revalidateHeatSurfaces(locale: string, slug: string) {
  revalidatePath(heatsPath(locale, slug));
  revalidatePath(adminPath(locale, `/events/${slug}`));
  revalidateStartList();
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
  revalidateHeatSurfaces(locale, slug);
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

  revalidateHeatSurfaces(locale, slug);
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
  revalidateHeatSurfaces(locale, slug);
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
  revalidateHeatSurfaces(locale, slug);
  back(locale, slug, `ok=assigned&n=${moved}`);
}

/**
 * Publish the event's heats and notify the runners it affects — the contract's
 * `publishHeats` (PRD #26). One press per event, re-pressable: only runners whose
 * heat or start time moved since their last notification are emailed, plus anyone
 * never notified (a walk-up seeded after the first press).
 *
 * The counts come back in the flash rather than being swallowed, because "did
 * that actually mail anyone?" is the whole question an admin has after pressing
 * it.
 */
export async function publishHeats(formData: FormData) {
  const locale = safeLocale(formData.get("locale"));
  await requireAdmin(locale);

  const slug = String(formData.get("slug") ?? "");
  if (!slug) {
    back(locale, slug, "error=input");
  }

  let summary: PublishHeatsSummary;
  try {
    summary = await publishHeatsAndNotify(slug);
  } catch (e) {
    back(locale, slug, e instanceof HeatPublishNotEligibleError ? "error=input" : "error=publish");
  }

  revalidateHeatSurfaces(locale, slug);
  back(
    locale,
    slug,
    `ok=published&published=${summary.published}&notified=${summary.notified}` +
      `&skipped=${summary.skipped}&failed=${summary.failed}`,
  );
}

/**
 * Seed a finals heat from imported qualification results: move the top-N
 * qualifiers (by net time, across every imported heat except the target's own)
 * into the chosen heat.
 *
 * Only rows the import linked to a registration are moved — an unlinked result
 * has nobody to assign, so it is reported back in the flash instead of guessed
 * at. Nobody is emailed here: the delta lands in inboxes when the admin presses
 * the existing (re-)publish button, exactly like a hand-seeded card.
 */
export async function seedFinalFromResults(formData: FormData) {
  const locale = safeLocale(formData.get("locale"));
  await requireAdmin(locale);

  const slug = String(formData.get("slug") ?? "");
  const heatId = String(formData.get("heatId") ?? "");
  const event = getEventBySlug(slug);
  if (!event || event.eventType !== "individual") {
    back(locale, slug, "error=input");
  }
  if (!heatId) {
    back(locale, slug, "error=noheat");
  }

  // A final larger than the bib pool cannot be chipped (ADR 0003) — same bound
  // the heat-capacity inputs enforce.
  const count = readInt(formData, "count");
  const pool = getBibPool(slug);
  if (count === null || count < 1 || count > pool) {
    back(locale, slug, "error=capacity");
  }

  const result = await seedTopQualifiers(slug, heatId, count);
  if (result.outcome === "missing-heat") {
    back(locale, slug, "error=missing");
  }
  if (result.outcome === "no-qualifiers") {
    back(locale, slug, `error=noqualifiers&unlinked=${result.unlinked}`);
  }

  revalidateHeatSurfaces(locale, slug);
  back(locale, slug, `ok=finalseeded&n=${result.seeded}&unlinked=${result.unlinked}`);
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
  revalidateHeatSurfaces(locale, slug);
  back(locale, slug, `ok=unassigned&n=${moved}`);
}
