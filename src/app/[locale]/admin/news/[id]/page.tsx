import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import "@/app/landing.css";

import { requireAdmin } from "@/features/admin/action-helpers";
import { AdminShell } from "@/features/admin/components/admin-shell";
import { NoDatabaseNotice } from "@/features/admin/components/no-database-notice";
import {
  NewsArticleForm,
  type NewsArticleFormValues,
} from "@/features/admin/components/news-article-form";
import { publishArticle, unpublishArticle, updateArticle } from "@/features/admin/news-actions";
import { getArticleById } from "@/features/admin/news-data";
import { Link } from "@/i18n/navigation";

export default async function AdminNewsEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ msg?: string }>;
}) {
  const { locale, id } = await params;
  const { msg } = await searchParams;
  setRequestLocale(locale);
  await requireAdmin(locale);

  if (!process.env.DATABASE_URL) {
    return (
      <AdminShell eyebrow="Admin · News" title="Article" narrow>
        <NoDatabaseNotice>edit news articles</NoDatabaseNotice>
      </AdminShell>
    );
  }

  const article = await getArticleById(id);
  if (!article) notFound();

  const initial: NewsArticleFormValues = {
    id: article.id,
    slug: article.slug,
    titlePl: article.titlePl,
    titleEn: article.titleEn,
    titleUa: article.titleUa,
    bodyPl: article.bodyPl,
    bodyEn: article.bodyEn,
    bodyUa: article.bodyUa,
    coverImageUrl: article.coverImageUrl ?? "",
  };

  return (
    <AdminShell
      eyebrow="Admin · News"
      title={article.titleEn || "(untitled)"}
      narrow
      actions={
        <Link href="/admin/news" className="btn btn-stroke btn-sm">
          All news
        </Link>
      }
    >
      {msg ? <div className="iv-notice iv-notice--info">{msg}</div> : null}

      <section className="iv-card" style={{ marginTop: 20 }}>
        <div
          className="iv-inline"
          style={{ marginBottom: 14, justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}
        >
          <span className={`iv-pill ${article.publishedAt ? "iv-pill--ok" : "iv-pill--due"}`}>
            {article.publishedAt ? "published" : "draft"}
          </span>

          <div className="iv-inline" style={{ gap: 10 }}>
            {article.publishedAt ? (
              <>
                <Link
                  href={`/news/${article.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-stroke btn-sm"
                >
                  View public page
                </Link>
                <form action={unpublishArticle}>
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="id" value={article.id} />
                  <button type="submit" className="btn btn-stroke btn-sm">
                    Unpublish
                  </button>
                </form>
              </>
            ) : (
              <form action={publishArticle}>
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="id" value={article.id} />
                <button type="submit" className="btn btn-red btn-sm">
                  Publish
                </button>
              </form>
            )}
          </div>
        </div>

        {!article.publishedAt ? (
          <p className="iv-note" style={{ marginBottom: 14 }}>
            Save your changes first — publish validates the stored article and requires every
            locale’s title and body plus a cover image.
          </p>
        ) : null}

        <NewsArticleForm
          action={updateArticle}
          locale={locale}
          initial={initial}
          submitLabel="Save changes"
        />
      </section>
    </AdminShell>
  );
}
