import { revalidatePath } from "next/cache";

import { adminPath } from "./action-helpers";

/**
 * Every surface an event record feeds, invalidated in one call.
 *
 * Events used to be compile-time config, so changing one meant a deploy and the
 * whole site rebuilt. Now that they are rows, a status flip or an edit has to
 * reach the public pages by itself — the same problem `media-actions.ts` and
 * `results-actions.ts` already solve, and the same shape of answer: public pages
 * stay SSG and get invalidated on demand, rather than going `force-dynamic` and
 * paying for a DB read on every visit.
 *
 * The route-pattern form (`"/[locale]/…"`, `"page"`) covers pl/en/ua in one call
 * each — the `revalidateMediaSurfaces` idiom. It also, deliberately, invalidates
 * *every* event's page rather than only this slug's: `[slug]` is a pattern, not a
 * value. That is the right trade here, because a single event's lifecycle change
 * moves shared surfaces anyway (the featured event, the series cards, the
 * archive), and an over-broad invalidation costs a re-render while a too-narrow
 * one leaves a stale race night advertising registration that has closed.
 *
 * The admin paths are literal, so they take the acting locale.
 */
export function revalidateEventSurfaces(locale: string, slug: string): void {
  // Landing: the featured event and the series cards both come from the store.
  revalidatePath("/[locale]", "page");
  // The event's own public surfaces. `/gallery` and `/results` are left to the
  // media and results actions, which own what changes them.
  revalidatePath("/[locale]/events/[slug]", "page");
  revalidatePath("/[locale]/events/[slug]/heats", "page");
  // The admin index card and the event's own admin pages.
  revalidatePath(adminPath(locale, "/events"));
  revalidatePath(adminPath(locale, `/events/${slug}`));
}
