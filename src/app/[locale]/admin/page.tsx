import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import "@/app/landing.css";

import { InteriorHeader } from "@/components/landing/interior-header";
import {
  adminLogout,
  deleteInquiry,
  markInquiryHandled,
  removeRunner,
  removeTeam,
} from "@/features/admin/actions";
import { CopyLinkButton } from "@/features/admin/components/copy-link-button";
import { ConfirmSubmit } from "@/features/admin/components/confirm-submit";
import { getAdminOverview, type InquiryRow } from "@/features/admin/data";
import { getSeriesEvents } from "@/lib/events/registry";
import { getAdminSession } from "@/lib/auth/admin-session";
import { defaultLocale } from "@/lib/i18n/config";

function fmt(date: Date) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default async function AdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  if (!(await getAdminSession())) {
    redirect(locale === defaultLocale ? "/admin/login" : `/${locale}/admin/login`);
  }

  return (
    <div className="ace-landing iv">
      <InteriorHeader />
      <main className="iv-main">
        <div className="iv-wrap">
          <div className="iv-toolbar">
            <div>
              <span className="iv-eyebrow">Admin</span>
              <h1 className="iv-title">Dashboard</h1>
            </div>
            <div className="iv-inline">
              <a
                href={locale === defaultLocale ? "/admin/mailings" : `/${locale}/admin/mailings`}
                className="btn btn-stroke btn-sm"
              >
                Mailings
              </a>
              <form action={adminLogout}>
                <input type="hidden" name="locale" value={locale} />
                <button type="submit" className="btn btn-stroke btn-sm">
                  Sign out
                </button>
              </form>
            </div>
          </div>

          {process.env.DATABASE_URL ? (
            <AdminBody locale={locale} />
          ) : (
            <div className="iv-notice iv-notice--info">
              No database connected. Set <code>DATABASE_URL</code> to view inquiries and registrations.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

async function AdminBody({ locale }: { locale: string }) {
  const data = await getAdminOverview();
  const seriesEvents = getSeriesEvents();
  const p = (suffix: string) => (locale === defaultLocale ? suffix : `/${locale}${suffix}`);

  return (
    <>
      <div className="iv-grid">
        <Stat label="Inquiries" value={`${data.totals.inquiries}`} sub={`${data.newInquiryCount} new`} />
        <Stat label="Runners" value={`${data.totals.runners}`} />
        <Stat label="Teams" value={`${data.totals.teams}`} />
        <Stat label="New inquiries" value={`${data.newInquiryCount}`} />
      </div>

      {/* ---- Individual mile series ---- */}
      {seriesEvents.length > 0 ? (
        <section className="iv-card" style={{ marginTop: 20 }}>
          <h2 className="iv-section-title">Mile series — check-in &amp; roster</h2>
          <div className="iv-tablewrap">
            <table className="iv-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {seriesEvents.map((e) => (
                  <tr key={e.slug}>
                    <td>{e.shortDate}</td>
                    <td>{e.timeRange ? `${e.timeRange.start}–${e.timeRange.end}` : "—"}</td>
                    <td>{e.status.replaceAll("_", " ")}</td>
                    <td>
                      <div className="iv-inline">
                        <a href={p(`/admin/events/${e.slug}`)} className="btn btn-stroke btn-sm">
                          Roster
                        </a>
                        <a href={p(`/admin/events/${e.slug}/checkin`)} className="btn btn-red btn-sm">
                          Check-in
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {/* ---- Inquiries ---- */}
      <section className="iv-card" style={{ marginTop: 20 }}>
        <h2 className="iv-section-title">Contact inquiries</h2>
        {data.inquiries.length === 0 ? (
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
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.inquiries.map((i) => (
                  <InquiryRowView key={i.id} inquiry={i} locale={locale} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ---- Teams ---- */}
      <section className="iv-card">
        <div className="iv-section-head">
          <h2 className="iv-section-title">Teams</h2>
          {data.teams.length > 0 ? (
            <a href="/api/admin/runners/export?scope=teams" className="btn btn-stroke btn-sm">
              Export Excel
            </a>
          ) : null}
        </div>
        {data.teams.length === 0 ? (
          <p className="iv-note">No teams yet.</p>
        ) : (
          <div className="iv-tablewrap">
            <table className="iv-table">
              <thead>
                <tr>
                  <th>Team</th>
                  <th>Code</th>
                  <th>Roster</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.teams.map((t) => (
                  <tr key={t.id}>
                    <td>{t.name}</td>
                    <td style={{ fontFamily: "var(--font-cta)" }}>{t.code}</td>
                    <td>
                      {t.runnerCount} / {t.size ?? "—"}
                    </td>
                    <td>{t.status}</td>
                    <td>{fmt(t.createdAt)}</td>
                    <td>
                      <div className="iv-inline">
                        <CopyLinkButton code={t.code} />
                        <form action={removeTeam}>
                          <input type="hidden" name="locale" value={locale} />
                          <input type="hidden" name="id" value={t.id} />
                          <ConfirmSubmit
                            label="Remove"
                            title="Remove team?"
                            message={`This permanently removes "${t.name}" and its ${t.runnerCount} runner(s). This cannot be undone.`}
                            confirmLabel="Remove team"
                          />
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ---- Runners ---- */}
      <section className="iv-card">
        <div className="iv-section-head">
          <h2 className="iv-section-title">Runners</h2>
          {data.runners.length > 0 ? (
            <div className="iv-inline">
              <a href="/api/admin/runners/export?scope=runners" className="btn btn-stroke btn-sm">
                Export runners
              </a>
              <a href="/api/admin/runners/export?scope=all" className="btn btn-stroke btn-sm">
                Export all sheets
              </a>
            </div>
          ) : null}
        </div>
        {data.runners.length === 0 ? (
          <p className="iv-note">No runners yet.</p>
        ) : (
          <div className="iv-tablewrap">
            <table className="iv-table">
              <thead>
                <tr>
                  <th>Runner</th>
                  <th>Contact</th>
                  <th>Type</th>
                  <th>Payment</th>
                  <th>Registered</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.runners.map((r) => (
                  <tr key={r.id}>
                    <td>{r.fullName}</td>
                    <td>
                      {r.email}
                      <div className="iv-cellsub">{r.phone}</div>
                    </td>
                    <td>{r.registrationType.replace("_", " ")}</td>
                    <td>
                      <span
                        className={`iv-pill ${
                          r.paymentStatus === "paid" || r.paymentStatus === "free"
                            ? "iv-pill--ok"
                            : "iv-pill--due"
                        }`}
                      >
                        {r.paymentStatus}
                      </span>
                    </td>
                    <td>{fmt(r.createdAt)}</td>
                    <td>
                      <form action={removeRunner}>
                        <input type="hidden" name="locale" value={locale} />
                        <input type="hidden" name="id" value={r.id} />
                        <ConfirmSubmit
                          label="Remove"
                          title="Remove runner?"
                          message={`This permanently removes ${r.fullName} from the event. This cannot be undone.`}
                          confirmLabel="Remove runner"
                        />
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function InquiryRowView({ inquiry, locale }: { inquiry: InquiryRow; locale: string }) {
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
    </tr>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="iv-info">
      <div className="iv-info__label">{label}</div>
      <div className="iv-info__value">{value}</div>
      {sub ? <div className="iv-cellsub">{sub}</div> : null}
    </div>
  );
}
