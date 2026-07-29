import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import "@/app/landing.css";
import "./news.css";

import { InteriorHeader } from "@/components/landing/interior-header";
import { listPublishedArticles } from "@/features/admin/news-data";
import { formatNewsDate } from "@/features/news/date";
import { bodyFor, deriveExcerpt, titleFor } from "@/features/news/text";
import { Link } from "@/i18n/navigation";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "news" });
  return { title: t("meta.listTitle") };
}

export default async function NewsListPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("news");
  const common = await getTranslations("common");
  const articles = await listPublishedArticles();

  return (
    <div className="ace-landing iv">
      <InteriorHeader />
      <main className="iv-main">
        <div className="iv-wrap">
          <span className="iv-eyebrow">{t("eyebrow")}</span>
          <h1 className="iv-title">{t("listTitle")}</h1>

          {articles.length === 0 ? (
            <p className="iv-sub news-empty">{t("empty")}</p>
          ) : (
            <div className="news-grid">
              {articles.map((article) => (
                <article className="news-card" key={article.slug}>
                  {article.coverImageUrl ? (
                    <Link href={`/news/${article.slug}`} className="news-card__cover">
                      {/* eslint-disable-next-line @next/next/no-img-element -- Blob-hosted cover */}
                      <img src={article.coverImageUrl} alt="" loading="lazy" />
                    </Link>
                  ) : null}
                  <time className="news-card__date" dateTime={article.publishedAt.toISOString()}>
                    {formatNewsDate(article.publishedAt, locale)}
                  </time>
                  <h2 className="news-card__title">
                    <Link href={`/news/${article.slug}`}>{titleFor(article, locale)}</Link>
                  </h2>
                  <p className="news-card__excerpt">{deriveExcerpt(bodyFor(article, locale))}</p>
                  <Link href={`/news/${article.slug}`} className="news-card__more">
                    {t("readMore")} →
                  </Link>
                </article>
              ))}
            </div>
          )}

          <div className="iv-actions" style={{ marginTop: 44 }}>
            <Link href="/" className="btn btn-red">
              {common("backToLanding")}
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
