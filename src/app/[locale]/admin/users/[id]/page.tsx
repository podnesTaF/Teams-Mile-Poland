import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import "@/app/landing.css";

import { requireAdmin } from "@/features/admin/action-helpers";
import { AdminShell } from "@/features/admin/components/admin-shell";
import { ConfirmSubmit } from "@/features/admin/components/confirm-submit";
import { NoDatabaseNotice } from "@/features/admin/components/no-database-notice";
import { formatAdminDateTime as fmt } from "@/features/admin/format";
import { deleteUser, resendUserVerification } from "@/features/admin/users-actions";
import { getUserDetail, type UserHistoryEntry, type UserProfile } from "@/features/admin/users-data";
import { Link } from "@/i18n/navigation";

export default async function AdminUserDetailPage({
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
      <AdminShell locale={locale} title="User" eyebrow="Admin · Users">
        <NoDatabaseNotice>view user details</NoDatabaseNotice>
      </AdminShell>
    );
  }

  const detail = await getUserDetail(id);
  if (!detail) notFound();
  const { user, history } = detail;
  const displayName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.name;

  return (
    <AdminShell
      locale={locale}
      eyebrow="Admin · Users"
      title={displayName}
      actions={
        <Link href="/admin/users" className="btn btn-stroke btn-sm">
          All users
        </Link>
      }
    >
      {msg ? <div className="iv-notice iv-notice--info">{msg}</div> : null}

      <ProfileCard user={user} />
      <HistoryCard history={history} />
      <ActionsCard user={user} locale={locale} />
    </AdminShell>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="iv-info">
      <div className="iv-info__label">{label}</div>
      <div className="iv-info__value">{value || "—"}</div>
    </div>
  );
}

function ProfileCard({ user }: { user: UserProfile }) {
  return (
    <section className="iv-card" style={{ marginTop: 20 }}>
      <h2 className="iv-section-title">Profile</h2>
      <div className="iv-grid" style={{ marginTop: 12 }}>
        <Field label="Email" value={user.email} />
        <Field label="Verified" value={user.emailVerified ? "Yes" : "No"} />
        <Field label="First name" value={user.firstName ?? ""} />
        <Field label="Last name" value={user.lastName ?? ""} />
        <Field
          label="Date of birth"
          value={user.dateOfBirth ? user.dateOfBirth.toISOString().slice(0, 10) : ""}
        />
        <Field label="Sex" value={user.sex ?? ""} />
        <Field label="Club" value={user.club ?? ""} />
        <Field label="Phone" value={user.phone ?? ""} />
        <Field label="Locale" value={user.locale} />
        <Field label="Marketing" value={user.marketingOptOut ? "Opted out" : "Subscribed"} />
        <Field label="Joined" value={fmt(user.createdAt)} />
      </div>
    </section>
  );
}

function HistoryStatusPill({ status }: { status: string }) {
  const cls =
    status === "attended" || status === "checked_in"
      ? "iv-pill--ok"
      : status === "no_show"
        ? "iv-pill--red"
        : "iv-pill--due";
  return <span className={`iv-pill ${cls}`}>{status.replaceAll("_", " ")}</span>;
}

function HistoryCard({ history }: { history: UserHistoryEntry[] }) {
  return (
    <section className="iv-card" style={{ marginTop: 18 }}>
      <h2 className="iv-section-title">Event history</h2>
      {history.length === 0 ? (
        <p className="iv-note" style={{ marginTop: 12 }}>
          No event history yet.
        </p>
      ) : (
        <div className="iv-tablewrap" style={{ marginTop: 12 }}>
          <table className="iv-table">
            <thead>
              <tr>
                <th>Event</th>
                <th>Type</th>
                <th>Status</th>
                <th>Bib</th>
                <th>Registered</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={`${h.kind}-${h.eventSlug}`}>
                  <td>{h.eventName}</td>
                  <td>{h.kind === "legacy" ? "Legacy" : "Series"}</td>
                  <td>
                    <HistoryStatusPill status={h.status} />
                  </td>
                  <td>{h.bib ?? "—"}</td>
                  <td>{fmt(h.registeredAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ActionsCard({ user, locale }: { user: UserProfile; locale: string }) {
  return (
    <section className="iv-card" style={{ marginTop: 18 }}>
      <h2 className="iv-section-title">Actions</h2>
      <div className="iv-inline" style={{ marginTop: 12 }}>
        {!user.emailVerified ? (
          <form action={resendUserVerification}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="id" value={user.id} />
            <input type="hidden" name="redirectTo" value={`/${user.id}`} />
            <button type="submit" className="btn btn-stroke btn-sm">
              Resend verification
            </button>
          </form>
        ) : null}
        <form action={deleteUser}>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="id" value={user.id} />
          <ConfirmSubmit
            label="Delete user"
            title="Delete this user?"
            message="This permanently removes the account and all of its registrations and history. This cannot be undone."
            confirmLabel="Delete"
          />
        </form>
      </div>
    </section>
  );
}
