import { setRequestLocale } from "next-intl/server";

import { requireAdmin } from "@/features/admin/action-helpers";
import { NoDatabaseNotice } from "@/features/admin/components/no-database-notice";
import { FeaturedEventCard } from "@/features/admin/components/dashboard/featured-event-card";
import { SeriesStrip } from "@/features/admin/components/dashboard/series-strip";
import { adminButton } from "@/features/admin/components/shell/admin-button";
import { AdminPage } from "@/features/admin/components/shell/admin-page";
import { AdminStat } from "@/features/admin/components/shell/admin-stat";
import { getRosterStats, type ParticipationStatus } from "@/features/admin/events-data";
import {
  getOverviewStats,
  RECENT_REGISTRATION_DAYS,
  type OverviewStats,
} from "@/features/admin/overview-data";
import { getFeaturedEvent, getIndividualEvents } from "@/lib/events/registry";
import type { EventSummary } from "@/lib/events/types";
import { Link } from "@/i18n/navigation";

/**
 * The admin dashboard, next-event-first: the event that needs attention leads,
 * the rest of the series sits under it, and the standing counts (inquiries,
 * entries, users) drop to a secondary row that doubles as navigation.
 *
 * Read-only. Lifecycle state comes from the registry server-side; the counts come
 * from the existing overview and roster-stats reads. Without a database the
 * registry half still renders — the notice explains the missing numbers rather
 * than replacing the page.
 */
export default async function AdminOverviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdmin(locale);

  // Completed nights included, as in the sidebar and the events index: a race
  // that has run keeps its pages, and its counts are the record of it.
  const events = getIndividualEvents();
  const featured = getFeaturedEvent();
  // The registry's featured event can in principle be the frozen team event;
  // it has no admin surfaces to link to, so the dashboard only ever leads with
  // an individual one.
  const featuredEvent = featured?.eventType === "individual" ? featured : null;

  if (!process.env.DATABASE_URL) {
    return (
      <AdminPage eyebrow="Admin" title="Dashboard">
        <div className="mb-5">
          <NoDatabaseNotice>view stats and registrations</NoDatabaseNotice>
        </div>
        <DashboardSections
          events={events}
          featured={featuredEvent}
          overview={null}
          rosterStats={null}
        />
      </AdminPage>
    );
  }

  return (
    <AdminPage eyebrow="Admin" title="Dashboard">
      <DashboardBody events={events} featured={featuredEvent} />
    </AdminPage>
  );
}

async function DashboardBody({
  events,
  featured,
}: {
  events: EventSummary[];
  featured: EventSummary | null;
}) {
  const [overview, rosterStats] = await Promise.all([
    getOverviewStats(events.map((event) => event.slug)),
    // The hero's breakdown is the roster header's own read, scoped to one event;
    // the strip's per-event totals come from the single grouped overview query.
    featured ? getRosterStats(featured.slug) : Promise.resolve(null),
  ]);

  return (
    <DashboardSections
      events={events}
      featured={featured}
      overview={overview}
      rosterStats={rosterStats}
    />
  );
}

function DashboardSections({
  events,
  featured,
  overview,
  rosterStats,
}: {
  events: EventSummary[];
  featured: EventSummary | null;
  overview: OverviewStats | null;
  rosterStats: Record<ParticipationStatus, number> | null;
}) {
  return (
    <>
      <FeaturedEventCard event={featured} stats={rosterStats} />

      <SeriesStrip
        events={events}
        counts={overview?.registrationsByEvent ?? null}
        featuredSlug={featured?.slug ?? null}
      />

      <section aria-labelledby="dashboard-secondary-heading" className="mt-5">
        <h2 id="dashboard-secondary-heading" className="sr-only">
          Panel totals
        </h2>
        <div className="grid gap-2.5 sm:grid-cols-3">
          <AdminStat
            label="New inquiries"
            value={overview?.newInquiries ?? "—"}
            hint="Unanswered contact messages"
            href="/admin/inquiries"
          />
          <AdminStat
            label="Recent registrations"
            value={overview?.recentRegistrations ?? "—"}
            hint={`Series-wide, last ${RECENT_REGISTRATION_DAYS} days`}
          />
          <AdminStat
            label="Users"
            value={overview?.totalUsers ?? "—"}
            hint={overview ? `${overview.verifiedUsers} verified` : "Accounts on the site"}
            href="/admin/users"
          />
        </div>
      </section>

      {/* The news teaser, shrunk: announcements are a content job, not an
          operational one, so it keeps a line rather than a card. */}
      <section className="mt-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-admin-lg border border-admin-line bg-admin-surface px-4 py-3.5">
        <p className="text-[13px] text-admin-muted">
          <span className="font-medium text-admin-ink-2">News</span> — author and manage on-site
          announcements.
        </p>
        <Link href="/admin/news" className={adminButton("stroke")}>
          Manage news
        </Link>
      </section>
    </>
  );
}
