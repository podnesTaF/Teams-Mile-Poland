import { setRequestLocale } from "next-intl/server";

import "@/app/landing.css";

import { requireAdmin } from "@/features/admin/action-helpers";
import { AdminPage } from "@/features/admin/components/shell/admin-page";
import { NoDatabaseNotice } from "@/features/admin/components/no-database-notice";
import { NewsArticleForm } from "@/features/admin/components/news-article-form";
import { createArticle } from "@/features/admin/news-actions";
import { Link } from "@/i18n/navigation";

export default async function AdminNewsNewPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ msg?: string }>;
}) {
  const { locale } = await params;
  const { msg } = await searchParams;
  setRequestLocale(locale);
  await requireAdmin(locale);

  return (
    <AdminPage
      eyebrow="Admin · News"
      title="New article"
      narrow
      actions={
        <Link href="/admin/news" className="btn btn-stroke btn-sm">
          All news
        </Link>
      }
    >
      {msg ? <div className="iv-notice iv-notice--info">{msg}</div> : null}

      {process.env.DATABASE_URL ? (
        <section className="iv-card" style={{ marginTop: 20 }}>
          <p className="iv-note" style={{ marginBottom: 14 }}>
            Saves as a draft. All three locales are required. Publishing comes in a later slice.
          </p>
          <NewsArticleForm action={createArticle} locale={locale} submitLabel="Create draft" />
        </section>
      ) : (
        <NoDatabaseNotice>create news articles</NoDatabaseNotice>
      )}
    </AdminPage>
  );
}
