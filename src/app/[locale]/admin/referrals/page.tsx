import { setRequestLocale } from "next-intl/server";

import "@/app/landing.css";

import { requireAdmin } from "@/features/admin/action-helpers";
import { AdminPage } from "@/features/admin/components/shell/admin-page";
import { AdminStat } from "@/features/admin/components/shell/admin-stat";
import { NoDatabaseNotice } from "@/features/admin/components/no-database-notice";
import { listReferrers } from "@/features/admin/referrals-data";
import { Link } from "@/i18n/navigation";

export default async function AdminReferralsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdmin(locale);

  return (
    <AdminPage title="Referrals">
      {process.env.DATABASE_URL ? (
        <ReferralsBody />
      ) : (
        <NoDatabaseNotice>view referral stats</NoDatabaseNotice>
      )}
    </AdminPage>
  );
}

async function ReferralsBody() {
  const referrers = await listReferrers();
  const totals = referrers.reduce(
    (acc, r) => ({
      signups: acc.signups + r.signups,
      raceRegistrations: acc.raceRegistrations + r.raceRegistrations,
      participations: acc.participations + r.participations,
    }),
    { signups: 0, raceRegistrations: 0, participations: 0 },
  );

  return (
    <>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <AdminStat label="Referrers" value={referrers.length} />
        <AdminStat label="Referred sign-ups" value={totals.signups} />
        <AdminStat label="Race registrations" value={totals.raceRegistrations} />
        <AdminStat
          label="Races run"
          value={totals.participations}
          hint="Checked in on site, plus legacy attendance"
        />
      </div>

      <section className="iv-card" style={{ marginTop: 20 }}>
        {referrers.length === 0 ? (
          <p className="iv-note">No referred sign-ups yet.</p>
        ) : (
          <div className="iv-tablewrap">
            <table className="iv-table">
              <thead>
                <tr>
                  <th>Referrer</th>
                  <th>Sign-ups</th>
                  <th>Race registrations</th>
                  <th>Races run</th>
                  <th>
                    <span className="sr-only">Detail</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {referrers.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link href={`/admin/users/${r.id}`} className="iv-linkbtn">
                        {r.name}
                      </Link>
                      <div className="iv-cellsub">{r.email}</div>
                    </td>
                    <td>{r.signups}</td>
                    <td>{r.raceRegistrations}</td>
                    <td>{r.participations}</td>
                    <td>
                      <Link href={`/admin/referrals/${r.id}`} className="iv-linkbtn">
                        Who they invited
                      </Link>
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
