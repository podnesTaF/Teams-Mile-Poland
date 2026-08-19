import { setRequestLocale } from "next-intl/server";

import "@/app/landing.css";

import { requireAdmin } from "@/features/admin/action-helpers";
import { AdminPage } from "@/features/admin/components/shell/admin-page";
import { ConfirmSubmit } from "@/features/admin/components/confirm-submit";
import { NoDatabaseNotice } from "@/features/admin/components/no-database-notice";
import { formatAdminDateTime as fmt } from "@/features/admin/format";
import { deleteArticle } from "@/features/admin/news-actions";
import { listArticles, type NewsListRow } from "@/features/admin/news-data";
import { Link } from "@/i18n/navigation";
import { userCan } from "@/lib/auth/user-session";

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
  const actor = await requireAdmin(locale);
  // Authoring is an `edit` act, and both the editor routes gate on it — so a
  // view-only admin gets the list of what exists and no way into a 404.
  const canEdit = userCan(actor, "edit");

  return (
    <AdminPage
      title="News"
      actions={
        canEdit ? (
          <Link href="/admin/news/new" className="btn btn-red btn-sm">
            New article
          </Link>
        ) : undefined
      }
    >
      {msg ? <div className="iv-notice iv-notice--info">{msg}</div> : null}

      {process.env.DATABASE_URL ? (
        <NewsBody locale={locale} canEdit={canEdit} />
      ) : (
        <NoDatabaseNotice>manage news articles</NoDatabaseNotice>
      )}
    </AdminPage>
  );
}

async function NewsBody({ locale, canEdit }: { locale: string; canEdit: boolean }) {
  const rows = await listArticles();

  return (
    <section className="iv-card" style={{ marginTop: 20 }}>
      {rows.length === 0 ? (
        <p className="iv-note">
          {canEdit
            ? "No articles yet. Create the first one with “New article”."
            : "No articles yet."}
        </p>
      ) : (
        <div className="iv-tablewrap">
          <table className="iv-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Slug</th>
                <th>State</th>
                <th>Updated</th>
                {canEdit ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <ArticleRowView key={r.id} row={r} locale={locale} canEdit={canEdit} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ArticleRowView({
  row,
  locale,
  canEdit,
}: {
  row: NewsListRow;
  locale: string;
  canEdit: boolean;
}) {
  return (
    <tr>
      <td>
        {/* The title is the way into the editor, so without `edit` it is text:
            `/admin/news/[id]` is an editor route and gates on `edit`. */}
        {canEdit ? (
          <Link href={`/admin/news/${row.id}`} className="iv-linkbtn">
            {row.titleEn || "(untitled)"}
          </Link>
        ) : (
          (row.titleEn || "(untitled)")
        )}
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
      {canEdit ? (
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
      ) : null}
    </tr>
  );
}
