"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { revalidateStartList } from "@/features/event-heats/start-list";
import { verifyEventTicket } from "@/features/ticket/sign";
import { getBibPool } from "@/lib/events/registry";
import { localePath } from "@/lib/i18n/config";

import { adminPath, requireAdmin, safeLocale } from "./action-helpers";
import {
  checkInWithBib,
  checkInWithoutBib,
  getHeldBib,
  getRegistrationEventSlug,
  isUniqueViolation,
  leaseBibForCheckedIn,
  setRegistrationStatus,
  suggestNextBib,
} from "./events-data";
import {
  finishHeatRow,
  placeWalkUp,
  unfinishHeatRow,
  type UnfinishOutcome,
  type WalkUpPlacement,
} from "./heats-data";

function checkinPath(locale: string, slug: string, query = "") {
  return adminPath(locale, `/events/${slug}/checkin${query}`);
}

/**
 * Every admin surface that renders leases or heat state after a race-morning edit.
 *
 * The public start list is **not** in here: it carries no bibs, so checking a
 * runner in cannot change it (PRD #26 cross-cutting decision 4), and the whole
 * point of that omission is to keep the page cheaply cached. The two race-morning
 * mutations that *do* change it call `revalidateStartList` explicitly — marking a
 * heat finished, and seeding a walk-up into a published heat, which changes who
 * the page lists.
 */
function revalidateRaceMorning(locale: string, slug: string) {
  revalidatePath(checkinPath(locale, slug));
  revalidatePath(adminPath(locale, `/events/${slug}`));
  revalidatePath(adminPath(locale, `/events/${slug}/heats`));
}

/**
 * How many times to re-suggest a bib when another desk takes the one we were
 * given. Only a genuine two-desk race gets here — an exhausted pool is reported
 * as such and never retried.
 */
const LEASE_ATTEMPTS = 5;

type LeaseResult =
  | { ok: "bib"; bib: number }
  | { ok: "pending" }
  /** Lost every suggestion to other desks while bibs were still free. */
  | { ok: "race" };

/**
 * Lease the lowest free bib and mark the runner present.
 *
 * An exhausted pool is not a failure (ADR 0003): the runner is checked in bib-less
 * and joins the waiting list.
 */
async function leaseAndCheckIn(slug: string, registrationId: string): Promise<LeaseResult> {
  // A bib pre-assigned in the heat builder is already this runner's lease —
  // checking in confirms it rather than stacking a second number on top.
  const held = await getHeldBib(registrationId);
  if (held !== null) {
    await checkInWithBib(registrationId, held);
    return { ok: "bib", bib: held };
  }

  for (let attempt = 0; attempt < LEASE_ATTEMPTS; attempt += 1) {
    const bib = await suggestNextBib(slug);
    if (bib === null) {
      await checkInWithoutBib(registrationId);
      return { ok: "pending" };
    }
    try {
      await checkInWithBib(registrationId, bib);
      return { ok: "bib", bib };
    } catch (error) {
      if (isUniqueViolation(error)) continue;
      throw error;
    }
  }
  return { ok: "race" };
}

/** `&heat=…` for a walk-up that was seeded, `&heat=none` for an unplaced one. */
function placementFlash(placement: WalkUpPlacement): string {
  if (placement.placed) return `&heat=${placement.heatNumber}`;
  return placement.reason === "no-room" ? "&heat=none" : "";
}

/**
 * Seed a walk-up, invalidating the public start list if that put a new name into a
 * published heat. The start list projects heat membership, so a walk-up changes it
 * even though a plain check-in does not.
 */
async function placeWalkUpAndRevalidate(
  slug: string,
  registrationId: string,
): Promise<WalkUpPlacement> {
  const placement = await placeWalkUp(slug, registrationId);
  if (placement.placed) revalidateStartList();
  return placement;
}

/**
 * The two surfaces that run a check-in. Like `confirmAttendance`'s surface token
 * (PRD #26 Contracts), the return URL is rebuilt from this server-side rather than
 * accepted as a caller-supplied path, so the action can never become an open
 * redirect.
 */
type Surface = "desk" | "ticket";

/**
 * Resolve the check-in's origin surface: its admin gate, the event it acts on, and
 * where to send the admin back to.
 *
 * The **desk** carries its own slug and search; the **ticket** panel is reached by
 * registration id alone (the QR carries no slug), so the event is read off the row
 * and the signature is re-checked. `requireAdmin` is the actual gate either way —
 * rendering the panel is not authorization (PRD #26) — but re-checking the
 * signature keeps the honest contract "check in the runner whose ticket you
 * scanned" rather than a check-in-anyone-by-id endpoint.
 */
async function resolveSurface(formData: FormData): Promise<{
  locale: string;
  slug: string;
  registrationId: string;
  /** Append `ok=`/`error=`/`heat=` params and redirect. */
  back: (params: string) => string;
}> {
  const locale = safeLocale(formData.get("locale"));
  await requireAdmin(locale, "checkin");

  const registrationId = String(formData.get("registrationId") ?? "");
  const surface: Surface = formData.get("surface") === "ticket" ? "ticket" : "desk";

  if (surface === "ticket") {
    const sig = String(formData.get("sig") ?? "");
    if (!registrationId || !sig || !verifyEventTicket(registrationId, sig)) {
      redirect(adminPath(locale));
    }
    const slug = await getRegistrationEventSlug(registrationId);
    if (!slug) {
      redirect(adminPath(locale));
    }
    return {
      locale,
      slug,
      registrationId,
      back: (params) =>
        localePath(
          locale,
          `/tickets/${encodeURIComponent(registrationId)}?s=${encodeURIComponent(sig)}&${params}#admin`,
        ),
    };
  }

  const slug = String(formData.get("slug") ?? "");
  const q = String(formData.get("q") ?? "");
  const prefix = q ? `?q=${encodeURIComponent(q)}&` : "?";
  return {
    locale,
    slug,
    registrationId,
    back: (params) => checkinPath(locale, slug, `${prefix}${params}`),
  };
}

/**
 * Lease a bib and check a runner in — the contract's `assignBibAndCheckIn`
 * (PRD #26), run from either the check-in desk or the inline admin panel on a
 * scanned ticket page, and redirecting back to whichever it came from.
 *
 * If a bib is supplied it is used verbatim (unique-violation → "bib held"); if
 * blank, the lowest free bib in the pool is leased, with a short retry loop to
 * absorb a concurrent desk taking it first. An exhausted pool is not a failure
 * (ADR 0003): the runner is checked in bib-less and the desk is told to free
 * numbers by marking a finished heat complete.
 *
 * A runner with no heat is a walk-up: they are auto-seeded into a published heat
 * with room, and left for deliberate placement when none has any.
 */
export async function assignBibAndCheckIn(formData: FormData) {
  const { locale, slug, registrationId, back } = await resolveSurface(formData);
  const bibRaw = String(formData.get("bib") ?? "").trim();

  if (!slug || !registrationId) {
    redirect(back("error=input"));
  }

  // Explicit bib: one attempt, surface conflicts.
  if (bibRaw) {
    const bib = Number.parseInt(bibRaw, 10);
    if (!Number.isInteger(bib) || bib < 1 || bib > (await getBibPool(slug))) {
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
    const placement = await placeWalkUpAndRevalidate(slug, registrationId);
    revalidateRaceMorning(locale, slug);
    redirect(back(`ok=${bib}${placementFlash(placement)}`));
  }

  const lease = await leaseAndCheckIn(slug, registrationId);
  if (lease.ok === "race") {
    redirect(back("error=bib_race"));
  }

  const placement = await placeWalkUpAndRevalidate(slug, registrationId);
  revalidateRaceMorning(locale, slug);
  redirect(
    back(`ok=${lease.ok === "pending" ? "pending" : lease.bib}${placementFlash(placement)}`),
  );
}

/**
 * Hand a freed bib to a runner already checked in — the waiting-list case, after a
 * finished heat returned its numbers (story 28). Their `checkedInAt` is left
 * alone: they were present before the bib existed.
 *
 * Not in the PRD's Contracts table, which names only the actions that lease at
 * check-in; the waiting list it does specify is unusable without it.
 */
export async function assignPendingBib(formData: FormData) {
  const { locale, slug, registrationId, back } = await resolveSurface(formData);

  if (!slug || !registrationId) {
    redirect(back("error=input"));
  }

  for (let attempt = 0; attempt < LEASE_ATTEMPTS; attempt += 1) {
    const bib = await suggestNextBib(slug);
    if (bib === null) {
      redirect(back("error=pool_empty"));
    }
    let leased: boolean;
    try {
      leased = await leaseBibForCheckedIn(slug, registrationId, bib);
    } catch (error) {
      if (isUniqueViolation(error)) continue;
      throw error;
    }
    if (!leased) {
      redirect(back("error=not_waiting"));
    }
    revalidateRaceMorning(locale, slug);
    redirect(back(`ok=${bib}`));
  }
  redirect(back("error=bib_race"));
}

/**
 * Mark a heat finished, returning every bib its members hold to the pool in one
 * action (PRD #26 `markHeatFinished`).
 */
export async function markHeatFinished(formData: FormData) {
  const locale = safeLocale(formData.get("locale"));
  await requireAdmin(locale, "checkin");

  const slug = String(formData.get("slug") ?? "");
  const heatId = String(formData.get("heatId") ?? "");
  const back = (params: string) => checkinPath(locale, slug, `?${params}`);
  if (!slug || !heatId) {
    redirect(back("error=input"));
  }

  const outcome = await finishHeatRow(slug, heatId);
  if (outcome.result === "missing") {
    redirect(back("error=heat_missing"));
  }
  if (outcome.result === "already") {
    redirect(back("error=heat_finished"));
  }
  if (outcome.result === "not-published") {
    redirect(back("error=heat_draft"));
  }

  revalidateRaceMorning(locale, slug);
  // The third heat mutation the contract names (PRD #26 Routes): publish, edit,
  // finish. `heat-actions.ts` owns the first two.
  revalidateStartList();
  redirect(back(`ok=finished&returned=${outcome.returned}`));
}

/**
 * Undo marking a heat finished (PRD #26 `unmarkHeatFinished`). Refused outright,
 * with the numbers named, if any bib it returned has since been re-leased — two
 * runners must never wear the same number at once (ADR 0003).
 */
export async function unmarkHeatFinished(formData: FormData) {
  const locale = safeLocale(formData.get("locale"));
  await requireAdmin(locale, "checkin");

  const slug = String(formData.get("slug") ?? "");
  const heatId = String(formData.get("heatId") ?? "");
  const back = (params: string) => checkinPath(locale, slug, `?${params}`);
  if (!slug || !heatId) {
    redirect(back("error=input"));
  }

  let outcome: UnfinishOutcome;
  try {
    outcome = await unfinishHeatRow(slug, heatId);
  } catch (error) {
    // A bib re-leased between the check and the write — same refusal, reported by
    // the index instead of by us.
    if (isUniqueViolation(error)) {
      redirect(back("error=bib_reused"));
    }
    throw error;
  }

  if (outcome.result === "missing") {
    redirect(back("error=heat_missing"));
  }
  if (outcome.result === "not-finished") {
    redirect(back("error=heat_open"));
  }
  if (outcome.result === "conflict") {
    redirect(back(`error=bib_reused&bibs=${outcome.bibs.join(",")}`));
  }

  revalidateRaceMorning(locale, slug);
  revalidateStartList();
  redirect(back(`ok=unfinished&released=${outcome.released}`));
}

/**
 * Mark a runner a no-show — from the desk, or from their scanned ticket.
 *
 * Goes through `resolveSurface` like the check-in itself (slice #45): the ticket
 * panel reaches this by registration id alone, so the signature is what keeps it
 * "the runner whose ticket you scanned" rather than a mark-anyone-by-id endpoint.
 * The redirect is what the panel's flash row reads, and it is what puts the
 * scan-the-next-runner press back on screen.
 */
export async function markNoShow(formData: FormData) {
  const { locale, slug, registrationId, back } = await resolveSurface(formData);
  if (!slug || !registrationId) {
    redirect(back("error=input"));
  }

  await setRegistrationStatus(registrationId, "no_show");
  revalidateRaceMorning(locale, slug);
  redirect(back("ok=noshow"));
}

/**
 * Revert a runner back to registered — undo a check-in, or undo a no-show. One
 * action for both, because both are the same write, and the surface it was
 * pressed on words which of the two happened.
 *
 * Any bib the runner held goes back to the pool (`setRegistrationStatus`), which
 * is why the presses that reach this are confirmed first.
 */
export async function revertToRegistered(formData: FormData) {
  const { locale, slug, registrationId, back } = await resolveSurface(formData);
  if (!slug || !registrationId) {
    redirect(back("error=input"));
  }

  await setRegistrationStatus(registrationId, "registered");
  revalidateRaceMorning(locale, slug);
  redirect(back("ok=registered"));
}
