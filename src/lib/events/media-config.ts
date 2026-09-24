import { cache } from "react";
import { eq, inArray } from "drizzle-orm";

import { eventMedia, type EventMediaRow } from "@/db/schema";
import { db } from "@/lib/db";

import { getPastEvents } from "./registry";
import { acceptsIndividuals, type EventSummary } from "./types";

/**
 * The DB-backed media publication state — which completed events have a
 * published Drive gallery, and where it lives. Successor of the old
 * `EventSummary.media` config field: publication is an admin action
 * (see `features/admin/media-actions.ts`), not a code edit + deploy.
 *
 * Deliberately forgiving, like `results-data.ts`: the landing, the event page
 * and the gallery route must all build and render when the database is missing
 * (local/preview) or briefly unreachable, so a failed read degrades to
 * "no media published" rather than taking the page down. The admin publish
 * action is where failures are loud.
 */

export type EventMediaConfig = Pick<
  EventMediaRow,
  "driveFolderId" | "coverFileId" | "photoCount" | "videoCount"
>;

/**
 * The published media config for one event, or `null` when nothing is
 * published (or the DB is unavailable). Request-cached so the event page, the
 * gallery page and its metadata share one read per render.
 */
export const getEventMediaConfig = cache(async (slug: string): Promise<EventMediaConfig | null> => {
  if (!db) return null;
  try {
    const rows = await db
      .select({
        driveFolderId: eventMedia.driveFolderId,
        coverFileId: eventMedia.coverFileId,
        photoCount: eventMedia.photoCount,
        videoCount: eventMedia.videoCount,
      })
      .from(eventMedia)
      .where(eq(eventMedia.eventSlug, slug));
    return rows[0] ?? null;
  } catch (error) {
    console.error(`[media] event_media read for ${slug} failed; treating as unpublished:`, error);
    return null;
  }
});

/**
 * Published media for many events at once — the landing archive section's
 * input, one query instead of one per card. Slugs without a row are absent.
 */
export async function getPublishedMedia(slugs: string[]): Promise<Map<string, EventMediaConfig>> {
  const map = new Map<string, EventMediaConfig>();
  if (!db || slugs.length === 0) return map;
  try {
    const rows = await db
      .select({
        eventSlug: eventMedia.eventSlug,
        driveFolderId: eventMedia.driveFolderId,
        coverFileId: eventMedia.coverFileId,
        photoCount: eventMedia.photoCount,
        videoCount: eventMedia.videoCount,
      })
      .from(eventMedia)
      .where(inArray(eventMedia.eventSlug, slugs));
    for (const { eventSlug, ...config } of rows) {
      map.set(eventSlug, config);
    }
  } catch (error) {
    console.error("[media] event_media batch read failed; archive shows no covers:", error);
  }
  return map;
}

/**
 * The landing archive's event list: completed individual events, newest first.
 * Reads the event store (a request-cached DB query, not the old config literal);
 * media publication state is overlaid per-card via {@link getPublishedMedia}. The legacy team event stays off the archive
 * because non-individual slugs have no event detail page to link to.
 */
export async function getArchiveEvents(): Promise<EventSummary[]> {
  return (await getPastEvents()).filter(acceptsIndividuals);
}

/** One row of the public gallery index: a completed night and its published gallery. */
export type GalleryEntry = { event: EventSummary; media: EventMediaConfig };

/**
 * The public `/gallery` index's input: the archive events that actually have a
 * published gallery, newest first. Same two reads as the landing archive, so the
 * two surfaces can never disagree about which nights have photos.
 */
export async function getGalleryEvents(): Promise<GalleryEntry[]> {
  const events = await getArchiveEvents();
  const media = await getPublishedMedia(events.map((e) => e.slug));
  return events.flatMap((event) => {
    const published = media.get(event.slug);
    return published ? [{ event, media: published }] : [];
  });
}
