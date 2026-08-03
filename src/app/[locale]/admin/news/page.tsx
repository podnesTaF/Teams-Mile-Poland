import { setRequestLocale } from "next-intl/server";

import "@/app/landing.css";

import { requireAdmin } from "@/features/admin/action-helpers";
import { AdminShell } from "@/features/admin/components/admin-shell";
import { ConfirmSubmit } from "@/features/admin/components/confirm-submit";
import { NoDatabaseNotice } from "@/features/admin/components/no-database-notice";
import { formatAdminDateTime as fmt } from "@/features/admin/format";
import { deleteArticle } from "@/features/admin/news-actions";
import { listArticles, type NewsListRow } from "@/features/admin/news-data";
import { Link } from "@/i18n/navigation";

export default async function AdminNewsPage({
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
    <AdminShell
      title="News"
      active="news"
      actions={
        <Link href="/admin/news/new" className="btn btn-red btn-sm">
          New article
        </Link>
      }
    >
      {msg ? <div className="iv-notice iv-notice--info">{msg}</div> : null}

      {process.env.DATABASE_URL ? (
        <NewsBody locale={locale} />
      ) : (
        <NoDatabaseNotice>manage news articles</NoDatabaseNotice>
      )}
    </AdminShell>
  );
}

async function NewsBody({ locale }: { locale: string }) {
  const rows = await listArticles();

  return (
    <section className="iv-card" style={{ marginTop: 20 }}>
      {rows.length === 0 ? (
        <p className="iv-note">No articles yet. Create the first one with “New article”.</p>
      ) : (
        <div className="iv-tablewrap">
          <table className="iv-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Slug</th>
                <th>State</th>
                <th>Updated</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <ArticleRowView key={r.id} row={r} locale={locale} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ArticleRowView({ row, locale }: { row: NewsListRow; locale: string }) {
  return (
    <tr>
      <td>
        <Link href={`/admin/news/${row.id}`} className="iv-linkbtn">
          {row.titleEn || "(untitled)"}
        </Link>
      </td>
      <td>
        <code>{row.slug}</code>
      </td>
      <td>
        <span className={`iv-pill ${row.isPublished ? "iv-pill--ok" : "iv-pill--due"}`}>
          {row.isPublished ? "published" : "draft"}
        </span>
      </td>
      <td>{fmt(row.updatedAt)}</td>
      <td>
        <div className="iv-inline">
          <Link href={`/admin/news/${row.id}`} className="iv-linkbtn">
            Edit
          </Link>
          <form action={deleteArticle}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="id" value={row.id} />
            <ConfirmSubmit
              label="Delete"
              title="Delete this article?"
              message="This permanently removes the article. This cannot be undone."
              confirmLabel="Delete"
            />
          </form>
        </div>
      </td>
    </tr>
  );
}
