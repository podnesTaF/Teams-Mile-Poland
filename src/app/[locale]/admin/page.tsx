import { setRequestLocale } from "next-intl/server";

import "@/app/landing.css";

import { requireAdmin } from "@/features/admin/action-helpers";
import { AdminShell } from "@/features/admin/components/admin-shell";
import { NoDatabaseNotice } from "@/features/admin/components/no-database-notice";
import { Stat } from "@/features/admin/components/stat";
import { getOverviewStats } from "@/features/admin/overview-data";
import { getSeriesEvents } from "@/lib/events/registry";
import { Link } from "@/i18n/navigation";

export default async function AdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdmin(locale);

  return (
    <AdminShell title="Dashboard" active="overview">
      {process.env.DATABASE_URL ? (
        <OverviewBody />
      ) : (
        <NoDatabaseNotice>view stats and registrations</NoDatabaseNotice>
      )}

      <section className="iv-card" style={{ marginTop: 20 }}>
        <div className="iv-toolbar" style={{ marginBottom: 0 }}>
          <div>
            <h2 className="iv-section-title">News</h2>
            <p className="iv-note" style={{ marginTop: 4 }}>
              Author and manage on-site announcements.
            </p>
          </div>
          <Link href="/admin/news" className="btn btn-stroke btn-sm">
            Manage news
          </Link>
        </div>
      </section>
    </AdminShell>
  );
}

async function OverviewBody() {
  const seriesEvents = getSeriesEvents();
  const stats = await getOverviewStats(seriesEvents.map((e) => e.slug));
  const seriesTotal = [...stats.registrationsByEvent.values()].reduce((a, b) => a + b, 0);

  return (
    <>
      <div className="iv-grid">
        <Stat label="Total users" value={stats.totalUsers} />
        <Stat label="Verified users" value={stats.verifiedUsers} />
        <Stat label="New inquiries" value={stats.newInquiries} />
        <Stat label="Series registrations" value={seriesTotal} />
      </div>

      <section className="iv-card" style={{ marginTop: 20 }}>
        <h2 className="iv-section-title">Mile series — check-in &amp; roster</h2>
        {seriesEvents.length === 0 ? (
          <p className="iv-note">No series events configured.</p>
        ) : (
          <div className="iv-tablewrap">
            <table className="iv-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Status</th>
                  <th>Registered</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {seriesEvents.map((e) => (
                  <tr key={e.slug}>
                    <td>{e.shortDate}</td>
                    <td>{e.timeRange ? `${e.timeRange.start}–${e.timeRange.end}` : "—"}</td>
                    <td>{e.status.replaceAll("_", " ")}</td>
                    <td>{stats.registrationsByEvent.get(e.slug) ?? 0}</td>
                    <td>
                      <div className="iv-inline">
                        <Link href={`/admin/events/${e.slug}`} className="btn btn-stroke btn-sm">
                          Roster
                        </Link>
                        <Link href={`/admin/events/${e.slug}/checkin`} className="btn btn-red btn-sm">
                          Check-in
                        </Link>
                      </div>
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
