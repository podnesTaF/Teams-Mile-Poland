import { setRequestLocale } from "next-intl/server";

import "@/app/landing.css";

import { requireAdmin } from "@/features/admin/action-helpers";
import { AdminPage } from "@/features/admin/components/shell/admin-page";
import { ConfirmSubmit } from "@/features/admin/components/confirm-submit";
import { NoDatabaseNotice } from "@/features/admin/components/no-database-notice";
import { listAdmins, type AdminRow } from "@/features/admin/admins-data";
import { inviteAdmin, removeAdmin, resendAdminInvite } from "@/features/admin/admins-actions";

export default async function AdminAdminsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ msg?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const actor = await requireAdmin(locale);

  return (
    <AdminPage title="Admins">
      {sp.msg ? <div className="iv-notice iv-notice--info">{sp.msg}</div> : null}

      {process.env.DATABASE_URL ? (
        <AdminsBody locale={locale} actorId={actor.id} />
      ) : (
        <NoDatabaseNotice>manage admins</NoDatabaseNotice>
      )}
    </AdminPage>
  );
}

async function AdminsBody({ locale, actorId }: { locale: string; actorId: string }) {
  const rows = await listAdmins();

  return (
    <>
      <form action={inviteAdmin} className="iv-card" style={{ marginTop: 20 }}>
        <input type="hidden" name="locale" value={locale} />
        <h2 className="iv-section-title">Add an admin</h2>
        <p className="iv-note">
          Enter an email address. If it has no account yet, one is created and a set-password email
          goes out; the person then signs in at the normal login and sees an <strong>Admin
          panel</strong> tab. An existing runner keeps the password they already have.
        </p>
        <div
          className="iv-inline"
          style={{ gap: 12, flexWrap: "wrap", alignItems: "flex-end", marginTop: 16 }}
        >
          <label style={{ flex: "1 1 260px" }}>
            <span className="iv-fieldlabel">Email</span>
            <input
              className="iv-input"
              type="email"
              name="email"
              required
              placeholder="name@email.com"
              autoComplete="off"
            />
          </label>
          <button type="submit" className="btn btn-red btn-sm">
            Send invite
          </button>
        </div>
      </form>

      <section className="iv-card" style={{ marginTop: 18 }}>
        {rows.length === 0 ? (
          <p className="iv-note">No admins yet.</p>
        ) : (
          <div className="iv-tablewrap">
            <table className="iv-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <AdminRowView key={row.id} row={row} locale={locale} actorId={actorId} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function AdminRowView({
  row,
  locale,
  actorId,
}: {
  row: AdminRow;
  locale: string;
  actorId: string;
}) {
  const isSelf = row.id === actorId;
  return (
    <tr>
      <td>
        {row.name}
        {isSelf ? <span className="iv-cellsub"> (you)</span> : null}
      </td>
      <td>{row.email}</td>
      <td>
        {/*
          "Pending" is the honest state for an invite: the row exists and the
          role is granted, but nobody can sign in as it until the set-password
          link is used. Resend rejections don't surface as errors (they land in
          the deploy log), so this column is how a dead invite becomes visible.
        */}
        <span className={`iv-pill ${row.hasPassword ? "iv-pill--ok" : "iv-pill--due"}`}>
          {row.hasPassword ? "active" : "pending invite"}
        </span>
      </td>
      <td>
        <div className="iv-inline">
          <form action={resendAdminInvite}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="email" value={row.email} />
            <button type="submit" className="iv-linkbtn">
              {row.hasPassword ? "Send reset link" : "Resend invite"}
            </button>
          </form>
          {isSelf ? null : (
            <form action={removeAdmin}>
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="id" value={row.id} />
              <ConfirmSubmit
                label="Remove admin"
                title="Remove admin access?"
                confirmLabel="Remove admin"
                message={`${row.email} will lose the admin panel. Their account, profile and registrations stay untouched.`}
              />
            </form>
          )}
        </div>
      </td>
    </tr>
  );
}
