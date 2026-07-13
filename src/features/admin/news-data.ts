import { cache } from "react";
import { and, desc, eq, isNotNull } from "drizzle-orm";

import { newsArticles, type NewsArticle } from "@/db/schema";
import { getDb } from "@/lib/db";

/** One row in the admin news list — enough to render state, title, and links. */
export type NewsListRow = {
  id: string;
  slug: string;
  titleEn: string;
  isPublished: boolean;
  updatedAt: Date;
};

/**
 * Every article for the admin list, including drafts, newest-first. Ordered by
 * `created_at` (not `published_at`, which is null on drafts) so freshly-created
 * drafts lead; the public surfaces sort by `published_at` instead.
 */
export async function listArticles(): Promise<NewsListRow[]> {
  const rows = await getDb()
    .select({
      id: newsArticles.id,
      slug: newsArticles.slug,
      titleEn: newsArticles.titleEn,
      publishedAt: newsArticles.publishedAt,
      updatedAt: newsArticles.updatedAt,
    })
    .from(newsArticles)
    .orderBy(desc(newsArticles.createdAt));

  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    titleEn: r.titleEn,
    isPublished: r.publishedAt !== null,
    updatedAt: r.updatedAt,
  }));
}

/** A single article by id for the admin edit form, or null if it does not exist. */
export async function getArticleById(id: string): Promise<NewsArticle | null> {
  const [article] = await getDb()
    .select()
    .from(newsArticles)
    .where(eq(newsArticles.id, id))
    .limit(1);
  return article ?? null;
}

/**
 * A published article carries a non-null `published_at`; the public surfaces
 * narrow to this so the display date is a plain `Date`, not `Date | null`.
 */
export type PublishedArticle = NewsArticle & { publishedAt: Date };

/**
 * Published articles for the public `/news` list, newest-first by `published_at`
 * (the publish date, which is also the sort key). Returns `[]` when no database
 * is configured so the page prerenders its empty state at build time without a
 * DB — publish mutations revalidate it once real data exists.
 */
export async function listPublishedArticles(): Promise<PublishedArticle[]> {
  if (!process.env.DATABASE_URL) return [];
  try {
    const rows = await getDb()
      .select()
      .from(newsArticles)
      .where(isNotNull(newsArticles.publishedAt))
      .orderBy(desc(newsArticles.publishedAt));
    return rows as PublishedArticle[];
  } catch (error) {
    // The list page is statically prerendered, so this query runs at build time.
    // If the store is unreachable or not yet migrated during the build, bake an
    // empty list rather than failing the whole build — a later publish
    // revalidates the page. At runtime (including on-demand revalidation) the
    // error is rethrown, so a transient blip never overwrites good news with an
    // empty cache entry.
    if (process.env.NEXT_PHASE === "phase-production-build") {
      console.warn("[news] build-time read failed; prerendering an empty list:", error);
      return [];
    }
    throw error;
  }
}

/**
 * The latest published articles for the landing "latest news" section, newest-first
 * by `published_at`, capped at `limit` (3 by default). Shares the build-time guard
 * of {@link listPublishedArticles}: no DB configured, or an unreachable/unmigrated
 * store during the build, yields `[]` so the landing prerenders without a news
 * section — a later publish revalidates the landing (see `revalidateNews`).
 */
export async function listLatestPublishedArticles(limit = 3): Promise<PublishedArticle[]> {
  if (!process.env.DATABASE_URL) return [];
  try {
    const rows = await getDb()
      .select()
      .from(newsArticles)
      .where(isNotNull(newsArticles.publishedAt))
      .orderBy(desc(newsArticles.publishedAt))
      .limit(limit);
    return rows as PublishedArticle[];
  } catch (error) {
    if (process.env.NEXT_PHASE === "phase-production-build") {
      console.warn("[news] build-time read failed; prerendering no landing section:", error);
      return [];
    }
    throw error;
  }
}

/**
 * A single *published* article by slug for `/news/[slug]`, or null when the slug
 * is unknown or still a draft — either case the page turns into a 404, so drafts
 * never leak publicly. Memoized per request so the page and its `generateMetadata`
 * share one query. Returns null without a database (see {@link listPublishedArticles}).
 */
export const getPublishedArticleBySlug = cache(
  async (slug: string): Promise<PublishedArticle | null> => {
    if (!process.env.DATABASE_URL) return null;
    const [article] = await getDb()
      .select()
      .from(newsArticles)
      .where(and(eq(newsArticles.slug, slug), isNotNull(newsArticles.publishedAt)))
      .limit(1);
    return (article as PublishedArticle | undefined) ?? null;
  },
);
