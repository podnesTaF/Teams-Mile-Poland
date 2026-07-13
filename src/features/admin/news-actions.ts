"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { newsArticles } from "@/db/schema";
import { getDb } from "@/lib/db";

import { adminPath, requireAdmin, safeLocale } from "./action-helpers";
import { slugify } from "./news-slug";

/** The six required trilingual text fields, trimmed. */
type ArticleText = {
  titlePl: string;
  titleEn: string;
  titleUa: string;
  bodyPl: string;
  bodyEn: string;
  bodyUa: string;
};

function readText(formData: FormData): ArticleText {
  const get = (k: string) => String(formData.get(k) ?? "").trim();
  return {
    titlePl: get("titlePl"),
    titleEn: get("titleEn"),
    titleUa: get("titleUa"),
    bodyPl: get("bodyPl"),
    bodyEn: get("bodyEn"),
    bodyUa: get("bodyUa"),
  };
}

/** First missing field, or null when all six are present. */
function firstMissing(text: ArticleText): string | null {
  const labels: [keyof ArticleText, string][] = [
    ["titleEn", "English title"],
    ["titlePl", "Polish title"],
    ["titleUa", "Ukrainian title"],
    ["bodyEn", "English body"],
    ["bodyPl", "Polish body"],
    ["bodyUa", "Ukrainian body"],
  ];
  for (const [key, label] of labels) {
    if (!text[key]) return label;
  }
  return null;
}

/** Postgres unique-violation surfaced by a slug collision. */
function isSlugCollision(error: unknown): boolean {
  return error instanceof Error && /unique|duplicate/i.test(error.message);
}

/**
 * Create a news article as a draft (`published_at` null, `cover_image_url`
 * empty — both are set by later slices). All six trilingual text fields are
 * required; the slug is normalised from the submitted value, falling back to
 * the English title, and a collision is reported back to the create form.
 */
export async function createArticle(formData: FormData) {
  const locale = safeLocale(formData.get("locale"));
  await requireAdmin(locale);

  function back(suffix: string, msg: string): never {
    revalidatePath(adminPath(locale, "/news"));
    redirect(adminPath(locale, `/news${suffix}?msg=${encodeURIComponent(msg)}`));
  }

  const text = readText(formData);
  const missing = firstMissing(text);
  if (missing) back("/new", `${missing} is required.`);

  const slug = slugify(String(formData.get("slug") ?? "")) || slugify(text.titleEn);
  if (!slug) back("/new", "Provide a slug or an English title.");

  try {
    await getDb().insert(newsArticles).values({ slug, ...text });
  } catch (error) {
    if (isSlugCollision(error)) back("/new", `The slug “${slug}” is already taken. Choose another.`);
    throw error;
  }
  back("", "Draft created.");
}

/**
 * Edit every field of an article. The slug is only mutable while the article is
 * a draft (frozen once `published_at` is set, so shared links never break); a
 * published article keeps its stored slug regardless of the submitted value.
 */
export async function updateArticle(formData: FormData) {
  const locale = safeLocale(formData.get("locale"));
  await requireAdmin(locale);
  const id = String(formData.get("id") ?? "");

  function back(suffix: string, msg: string): never {
    revalidatePath(adminPath(locale, "/news"));
    redirect(adminPath(locale, `/news${suffix}?msg=${encodeURIComponent(msg)}`));
  }

  if (!id) back("", "No article specified.");
  const editPath = `/${id}`;

  const db = getDb();
  const [existing] = await db
    .select({ publishedAt: newsArticles.publishedAt })
    .from(newsArticles)
    .where(eq(newsArticles.id, id))
    .limit(1);
  if (!existing) back("", "Article not found.");

  const text = readText(formData);
  const missing = firstMissing(text);
  if (missing) back(editPath, `${missing} is required.`);

  const isDraft = existing.publishedAt === null;
  const submittedSlug = slugify(String(formData.get("slug") ?? "")) || slugify(text.titleEn);
  if (isDraft && !submittedSlug) back(editPath, "Provide a slug or an English title.");

  // Only drafts may change their slug; a published article's slug column stays
  // as stored, so we simply omit it from the update.
  const values = isDraft ? { slug: submittedSlug, ...text, updatedAt: new Date() } : { ...text, updatedAt: new Date() };

  try {
    await db.update(newsArticles).set(values).where(eq(newsArticles.id, id));
  } catch (error) {
    if (isSlugCollision(error)) {
      back(editPath, `The slug “${submittedSlug}” is already taken. Choose another.`);
    }
    throw error;
  }
  back(editPath, "Article saved.");
}

/** Delete an article. Confirm dialog upstream. */
export async function deleteArticle(formData: FormData) {
  const locale = safeLocale(formData.get("locale"));
  await requireAdmin(locale);
  const id = String(formData.get("id") ?? "");

  function back(msg: string): never {
    revalidatePath(adminPath(locale, "/news"));
    redirect(adminPath(locale, `/news?msg=${encodeURIComponent(msg)}`));
  }

  if (!id) back("No article specified.");

  await getDb().delete(newsArticles).where(eq(newsArticles.id, id));
  back("Article deleted.");
}
