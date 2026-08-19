import { setRequestLocale } from "next-intl/server";

import "@/app/landing.css";

import { requireAdmin } from "@/features/admin/action-helpers";
import { AdminPage } from "@/features/admin/components/shell/admin-page";
import { NoDatabaseNotice } from "@/features/admin/components/no-database-notice";
import { formatAdminDateTime as fmt } from "@/features/admin/format";
import { deleteInquiry, markInquiryHandled } from "@/features/admin/inquiries-actions";
import { listInquiries, type InquiryRow } from "@/features/admin/inquiries-data";
import { userCan } from "@/lib/auth/user-session";

export default async function AdminInquiriesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const actor = await requireAdmin(locale);
  // Marking handled and deleting both ask for `edit`; reading the messages does
  // not, so a view-only admin gets the table without the row controls.
  const canEdit = userCan(actor, "edit");

  return (
    <AdminPage title="Contact inquiries">
      {process.env.DATABASE_URL ? (
        <InquiriesBody locale={locale} canEdit={canEdit} />
      ) : (
        <NoDatabaseNotice>view inquiries</NoDatabaseNotice>
      )}
    </AdminPage>
  );
}

async function InquiriesBody({ locale, canEdit }: { locale: string; canEdit: boolean }) {
  const inquiries = await listInquiries();

  return (
    <section className="iv-card" style={{ marginTop: 20 }}>
      {inquiries.length === 0 ? (
        <p className="iv-note">No inquiries yet.</p>
      ) : (
        <div className="iv-tablewrap">
          <table className="iv-table">
            <thead>
              <tr>
                <th>Contact</th>
                <th>Method</th>
                <th>Message</th>
                <th>Received</th>
                <th>Status</th>
                {canEdit ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {inquiries.map((i) => (
                <InquiryRowView key={i.id} inquiry={i} locale={locale} canEdit={canEdit} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function InquiryRowView({
  inquiry,
  locale,
  canEdit,
}: {
  inquiry: InquiryRow;
  locale: string;
  canEdit: boolean;
}) {
  const handled = inquiry.status === "handled";
  return (
    <tr>
      <td>
        {inquiry.name}
        <div className="iv-cellsub">{inquiry.email}</div>
        <div className="iv-cellsub">{inquiry.phone}</div>
      </td>
      <td style={{ textTransform: "capitalize" }}>{inquiry.method}</td>
      <td className="iv-table__msg">{inquiry.message || "—"}</td>
      <td>{fmt(inquiry.createdAt)}</td>
      <td>
        <span className={`iv-pill ${handled ? "iv-pill--ok" : "iv-pill--red"}`}>
          {handled ? "handled" : "new"}
        </span>
      </td>
      {canEdit ? (
        <td>
          <div className="iv-inline">
            <form action={markInquiryHandled}>
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="id" value={inquiry.id} />
              <input type="hidden" name="next" value={handled ? "new" : "handled"} />
              <button type="submit" className="iv-linkbtn">
                {handled ? "Mark new" : "Mark handled"}
              </button>
            </form>
            <form action={deleteInquiry}>
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="id" value={inquiry.id} />
              <button type="submit" className="iv-linkbtn iv-linkbtn--danger">
                Delete
              </button>
            </form>
          </div>
        </td>
      ) : null}
    </tr>
  );
}
