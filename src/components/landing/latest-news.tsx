import { getLocale, getTranslations } from "next-intl/server";

import { listLatestPublishedArticles } from "@/features/admin/news-data";
import { formatNewsDate } from "@/features/news/date";
import { bodyFor, deriveExcerpt, titleFor } from "@/features/news/text";
import { Link } from "@/i18n/navigation";

/**
 * Landing "latest news" section — the three most recently published articles as
 * cards linking to their `/news/[slug]` page, plus an "all news" link to `/news`.
 * Server-rendered from the cached news data (kept in sync by the news mutations'
 * `revalidatePath("/[locale]", "page")`), so the landing stays non-dynamic.
 * Renders **nothing at all** when there is no published article — no heading, no
 * empty box (PRD user story 8).
 */
export async function LatestNews() {
  const articles = await listLatestPublishedArticles(3);
  if (articles.length === 0) return null;

  const locale = await getLocale();
  const t = await getTranslations("news");

  return (
    <section className="section news-sec" id="news" data-screen-label="Latest news">
      <div className="wrap">
        <div className="news-sec__head">
          <div>
            <p className="ev-eyebrow">{t("eyebrow")}</p>
            <h2 className="head t-sec">{t("landingTitle")}</h2>
          </div>
          <Link href="/news" className="btn btn-stroke news-sec__all">
            {t("allNews")}
          </Link>
        </div>

        <div className="news-sec__grid">
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
              <h3 className="news-card__title">
                <Link href={`/news/${article.slug}`}>{titleFor(article, locale)}</Link>
              </h3>
              <p className="news-card__excerpt">{deriveExcerpt(bodyFor(article, locale))}</p>
              <Link href={`/news/${article.slug}`} className="news-card__more">
                {t("readMore")} →
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
