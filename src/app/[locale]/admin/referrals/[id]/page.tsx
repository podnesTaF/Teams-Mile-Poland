import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import "@/app/landing.css";

import { requireAdmin } from "@/features/admin/action-helpers";
import { AdminPage } from "@/features/admin/components/shell/admin-page";
import { AdminStat } from "@/features/admin/components/shell/admin-stat";
import { NoDatabaseNotice } from "@/features/admin/components/no-database-notice";
import { formatAdminDateTime as fmt } from "@/features/admin/format";
import { getReferrerDetail } from "@/features/admin/referrals-data";
import { Link } from "@/i18n/navigation";

/**
 * One referrer's drill-down: every account their link brought in, each with its
 * own funnel numbers — the row-level view behind `/admin/referrals`' aggregate
 * table. Read-only; acting on a referred account happens on its user detail.
 */
export default async function AdminReferrerDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireAdmin(locale);

  if (!process.env.DATABASE_URL) {
    return (
      <AdminPage title="Referrer" eyebrow="Admin · Referrals">
        <NoDatabaseNotice>view referral details</NoDatabaseNotice>
      </AdminPage>
    );
  }

  const detail = await getReferrerDetail(id);
  if (!detail) notFound();
  const { referrer, referred } = detail;
  const totals = referred.reduce(
    (acc, r) => ({
      raceRegistrations: acc.raceRegistrations + r.raceRegistrations,
      racesRun: acc.racesRun + r.racesRun,
    }),
    { raceRegistrations: 0, racesRun: 0 },
  );

  return (
    <AdminPage
      eyebrow="Admin · Referrals"
      title={referrer.name}
      actions={
        <>
          <Link href={`/admin/users/${referrer.id}`} className="btn btn-stroke btn-sm">
            User detail
          </Link>
          <Link href="/admin/referrals" className="btn btn-stroke btn-sm">
            All referrers
          </Link>
        </>
      }
    >
      <div className="mt-5 grid grid-cols-3 gap-3">
        <AdminStat label="Sign-ups" value={referred.length} />
        <AdminStat label="Race registrations" value={totals.raceRegistrations} />
        <AdminStat
          label="Races run"
          value={totals.racesRun}
          hint="Checked in on site, plus legacy attendance"
        />
      </div>

      <section className="iv-card" style={{ marginTop: 20 }}>
        <h2 className="iv-section-title">Referred accounts</h2>
        {referred.length === 0 ? (
          <p className="iv-note" style={{ marginTop: 12 }}>
            No accounts were created through this user&apos;s link.
          </p>
        ) : (
          <div className="iv-tablewrap" style={{ marginTop: 12 }}>
            <table className="iv-table">
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Signed up</th>
                  <th>Verified</th>
                  <th>Race registrations</th>
                  <th>Races run</th>
                </tr>
              </thead>
              <tbody>
                {referred.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link href={`/admin/users/${r.id}`} className="iv-linkbtn">
                        {r.name}
                      </Link>
                      <div className="iv-cellsub">{r.email}</div>
                    </td>
                    <td>{fmt(r.signedUpAt)}</td>
                    <td>{r.emailVerified ? "Yes" : "No"}</td>
                    <td>{r.raceRegistrations}</td>
                    <td>{r.racesRun}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AdminPage>
  );
}
