import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * A completed event's published Drive gallery — the DB successor of the old
 * `EventSummary.media` config field (PRD #14). One row per event, keyed by
 * `event_slug` text like `event_results` (no FK — events live in the config
 * registry, not the DB).
 *
 * Row exists = media is published: the public gallery page renders, the event
 * page shows the teaser, and the media-live mailing may be sent. Publication is
 * an admin action now, not a deploy — the publish action lists the folder via
 * the Drive API before accepting it (the fail-loud gate that used to abort the
 * build), so a row can never point at an unreadable or empty folder.
 *
 * `cover_file_id` and the counts are snapshots taken at publish time so the
 * landing archive card and the gallery's OG image need no Drive call at render;
 * re-publishing the same folder refreshes them.
 */
export const eventMedia = pgTable("event_media", {
  eventSlug: text("event_slug").primaryKey(),
  /** The public ("anyone with link") Drive folder holding the photos/videos. */
  driveFolderId: text("drive_folder_id").notNull(),
  /** Drive file id of the first photo — the cover/OG image; null if video-only. */
  coverFileId: text("cover_file_id"),
  photoCount: integer("photo_count").notNull(),
  videoCount: integer("video_count").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type EventMediaRow = typeof eventMedia.$inferSelect;
