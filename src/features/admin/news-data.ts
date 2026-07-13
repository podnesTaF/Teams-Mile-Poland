import { desc, eq } from "drizzle-orm";

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
