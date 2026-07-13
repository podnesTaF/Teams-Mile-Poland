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
 * Invalidate every news surface after a mutation: the admin list plus the three
 * public surfaces (list, article page, landing "latest" section) across all
 * locales. The public paths use the route-pattern form (`[locale]` / `[slug]`
 * are dynamic segments) so one call covers pl/en/ua and every article at once —
 * this is what makes a publish/unpublish/edit visible immediately without a
 * deploy. (This repo does not enable Cache Components, so `revalidatePath` is
 * the on-demand primitive — verified against `node_modules/next/dist/docs`.)
 */
function revalidateNews(locale: string) {
  revalidatePath(adminPath(locale, "/news"));
  revalidatePath("/[locale]/news", "page");
  revalidatePath("/[locale]/news/[slug]", "page");
  revalidatePath("/[locale]", "page");
}

/**
 * Create a news article as a draft (`published_at` null, `cover_image_url`
 * empty — the cover joins at publish in the images slice). A draft may be saved
 * partially so an admin can prepare a post across sessions; completeness of all
 * six locale fields is enforced only at publish. The slug is required (it is the
 * article's public identity), normalised from the submitted value and falling
 * back to the English title; a collision is reported back to the create form.
 */
export async function createArticle(formData: FormData) {
  const locale = safeLocale(formData.get("locale"));
  await requireAdmin(locale);

  function back(suffix: string, msg: string): never {
    revalidateNews(locale);
    redirect(adminPath(locale, `/news${suffix}?msg=${encodeURIComponent(msg)}`));
  }

  const text = readText(formData);
  const slug = slugify(String(formData.get("slug") ?? "")) || slugify(text.titleEn);
  if (!slug) back("/new", "Provide a slug or an English title.");

  try {
    await getDb()
      .insert(newsArticles)
      .values({ slug, ...text });
  } catch (error) {
    if (isSlugCollision(error))
      back("/new", `The slug “${slug}” is already taken. Choose another.`);
    throw error;
  }
  back("", "Draft created.");
}

/**
 * Edit every field of an article. Fields may be left blank on a draft (see
 * `createArticle`); publish is what demands completeness. The slug is only
 * mutable while the article is a draft (frozen once `published_at` is set, so
 * shared links never break); a published article keeps its stored slug
 * regardless of the submitted value.
 */
export async function updateArticle(formData: FormData) {
  const locale = safeLocale(formData.get("locale"));
  await requireAdmin(locale);
  const id = String(formData.get("id") ?? "");

  function back(suffix: string, msg: string): never {
    revalidateNews(locale);
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
  const isDraft = existing.publishedAt === null;
  const submittedSlug = slugify(String(formData.get("slug") ?? "")) || slugify(text.titleEn);
  if (isDraft && !submittedSlug) back(editPath, "Provide a slug or an English title.");

  // Drafts may be saved partially, but a published article is live — editing it
  // must not blank a locale field out from under the public surfaces. Hold
  // published articles to the same completeness bar as publish.
  if (!isDraft) {
    const missing = firstMissing(text);
    if (missing) back(editPath, `${missing} is required while the article is published.`);
  }

  // Only drafts may change their slug; a published article's slug column stays
  // as stored, so we simply omit it from the update.
  const values = isDraft
    ? { slug: submittedSlug, ...text, updatedAt: new Date() }
    : { ...text, updatedAt: new Date() };

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

/**
 * Publish an article: validate that all six trilingual text fields are present
 * (the cover-image requirement joins this check in the images slice) and stamp
 * `published_at`, which flips it live on the public surfaces. Validation runs
 * against the *stored* row — the admin saves edits first, then publishes — so a
 * half-translated article is rejected and stays a draft.
 */
export async function publishArticle(formData: FormData) {
  const locale = safeLocale(formData.get("locale"));
  await requireAdmin(locale);
  const id = String(formData.get("id") ?? "");

  function back(suffix: string, msg: string): never {
    revalidateNews(locale);
    redirect(adminPath(locale, `/news${suffix}?msg=${encodeURIComponent(msg)}`));
  }

  if (!id) back("", "No article specified.");
  const editPath = `/${id}`;

  const db = getDb();
  const [existing] = await db.select().from(newsArticles).where(eq(newsArticles.id, id)).limit(1);
  if (!existing) back("", "Article not found.");

  const text: ArticleText = {
    titlePl: existing.titlePl.trim(),
    titleEn: existing.titleEn.trim(),
    titleUa: existing.titleUa.trim(),
    bodyPl: existing.bodyPl.trim(),
    bodyEn: existing.bodyEn.trim(),
    bodyUa: existing.bodyUa.trim(),
  };
  const missing = firstMissing(text);
  if (missing) back(editPath, `Cannot publish — ${missing} is missing. Fill every locale first.`);

  // Idempotent: re-publishing an already-live article keeps its original date.
  if (existing.publishedAt === null) {
    await db
      .update(newsArticles)
      .set({ publishedAt: new Date(), updatedAt: new Date() })
      .where(eq(newsArticles.id, id));
  }
  back(editPath, "Article published — now live on the public site.");
}

/**
 * Unpublish an article back to draft by clearing `published_at`; it vanishes
 * from the public surfaces (its `/news/[slug]` page 404s) until published again.
 */
export async function unpublishArticle(formData: FormData) {
  const locale = safeLocale(formData.get("locale"));
  await requireAdmin(locale);
  const id = String(formData.get("id") ?? "");

  function back(suffix: string, msg: string): never {
    revalidateNews(locale);
    redirect(adminPath(locale, `/news${suffix}?msg=${encodeURIComponent(msg)}`));
  }

  if (!id) back("", "No article specified.");

  await getDb()
    .update(newsArticles)
    .set({ publishedAt: null, updatedAt: new Date() })
    .where(eq(newsArticles.id, id));
  back(`/${id}`, "Article unpublished — back to draft.");
}

/** Delete an article. Confirm dialog upstream. */
export async function deleteArticle(formData: FormData) {
  const locale = safeLocale(formData.get("locale"));
  await requireAdmin(locale);
  const id = String(formData.get("id") ?? "");

  function back(msg: string): never {
    revalidateNews(locale);
    redirect(adminPath(locale, `/news?msg=${encodeURIComponent(msg)}`));
  }

  if (!id) back("No article specified.");

  await getDb().delete(newsArticles).where(eq(newsArticles.id, id));
  back("Article deleted.");
}
