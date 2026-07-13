import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import "@/app/landing.css";
import "../news.css";

import { InteriorHeader } from "@/components/landing/interior-header";
import { getPublishedArticleBySlug } from "@/features/admin/news-data";
import { ArticleBody } from "@/features/news/components/article-body";
import { formatNewsDate } from "@/features/news/date";
import { bodyFor, titleFor } from "@/features/news/text";
import { Link } from "@/i18n/navigation";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const article = await getPublishedArticleBySlug(slug);
  if (!article) return {};
  return { title: titleFor(article, locale) };
}

export default async function NewsArticlePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  // Drafts and unknown slugs both resolve to null → 404, so unpublished content
  // never leaks.
  const article = await getPublishedArticleBySlug(slug);
  if (!article) notFound();

  const t = await getTranslations("news");

  return (
    <div className="ace-landing iv">
      <InteriorHeader />
      <main className="iv-main">
        <div className="iv-wrap">
          <Link href="/news" className="detail-back">
            {t("backToNews")}
          </Link>

          <span className="iv-eyebrow">{t("eyebrow")}</span>
          <h1 className="iv-title">{titleFor(article, locale)}</h1>
          <p className="iv-meta">
            <time dateTime={article.publishedAt.toISOString()}>
              {formatNewsDate(article.publishedAt, locale)}
            </time>
          </p>

          <div className="news-prose">
            <ArticleBody markdown={bodyFor(article, locale)} />
          </div>
        </div>
      </main>
    </div>
  );
}
