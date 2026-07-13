import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * On-site news articles — admin-authored announcements shown on the public news
 * surfaces (list, article page, landing preview). Standalone: no `event_slug`,
 * no FK to the event registry (news is not an event).
 *
 * Content is trilingual with per-locale columns (not jsonb); all three locales
 * are required at publish time, enforced in the publish action, not here. The
 * slug is shared across locales and unique; it is editable while the article is
 * a draft and frozen once published.
 *
 * `published_at` is the single source of draft-vs-published state: null = draft,
 * non-null = published, and it doubles as the display date and newest-first sort
 * key. `cover_image_url` holds a Blob URL (required to publish, enforced in the
 * action). Both are nullable and stay empty in the draft-CRUD slice.
 */
export const newsArticles = pgTable("news_articles", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  titlePl: text("title_pl").notNull(),
  titleEn: text("title_en").notNull(),
  titleUa: text("title_ua").notNull(),
  bodyPl: text("body_pl").notNull(),
  bodyEn: text("body_en").notNull(),
  bodyUa: text("body_ua").notNull(),
  coverImageUrl: text("cover_image_url"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type NewsArticle = typeof newsArticles.$inferSelect;
