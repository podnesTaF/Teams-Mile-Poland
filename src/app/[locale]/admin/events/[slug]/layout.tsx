import { Suspense, type ReactNode } from "react";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { requireAdmin } from "@/features/admin/action-helpers";
import { DownloadLink } from "@/features/admin/components/download-link";
import { adminButton } from "@/features/admin/components/shell/admin-button";
import { AdminPage } from "@/features/admin/components/shell/admin-page";
import {
  AdminEventHeader,
  AdminEventStats,
  AdminEventStatsSkeleton,
  type EventHeaderStat,
} from "@/features/admin/components/shell/event-header";
import { AdminEventTabs } from "@/features/admin/components/shell/event-tabs";
import { getRosterStats } from "@/features/admin/events-data";
import { getEventBySlug } from "@/lib/events/registry";

/**
 * The shared chrome for one event's three operational pages — roster, heats and
 * check-in. It states the event once (header: date, lifecycle status, key
 * stats, event-level actions) and offers the three tabs, so the pages below it
 * are lean: their own data, their own flashes, nothing about which event this is
 * or how to reach its siblings.
 *
 * URLs are untouched: this wraps the three routes that already existed.
 *
 * Unlike the admin shell layout, this one *does* guard. It renders admin-only
 * registration counts, and the `loading.tsx` beside this file is a Suspense
 * boundary *between* the layout and its child pages — so this layout's output
 * can be flushed to the browser before a child page's own `requireAdmin` has
 * even run. It is still not the *sole* guard: layouts are skipped on
 * client-side navigation between their own pages, so each tab keeps calling
 * `requireAdmin` itself. (`getUser` is request-cached, so the extra call costs
 * no extra session lookup.)
 *
 * The registry guard is duplicated for the same reason: an unknown slug, or the
 * frozen team event, must not get a header before the page 404s.
 */
export default async function AdminEventLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  await requireAdmin(locale);

  const event = getEventBySlug(slug);
  if (!event || event.eventType !== "individual") notFound();

  return (
    <AdminPage eyebrow="Events" title={event.name}>
      <AdminEventHeader
        event={event}
        actions={
          <>
            <DownloadLink href={`/api/admin/events/${slug}/export`} className={adminButton()}>
              Export roster
            </DownloadLink>
            <DownloadLink href={`/api/admin/events/${slug}/heats/export`} className={adminButton()}>
              Export heat cards
            </DownloadLink>
            {/* The photos-live mailing button lives on the Media tab, next to
                the gallery publication it depends on. */}
          </>
        }
        stats={
          // Next's layout guidance: runtime data access in a layout gets its own
          // Suspense boundary, or it blocks the navigation into the layout.
          <Suspense fallback={<AdminEventStatsSkeleton />}>
            <EventStats slug={slug} />
          </Suspense>
        }
      />

      <AdminEventTabs slug={slug} />

      <div className="mt-5">{children}</div>
    </AdminPage>
  );
}

/**
 * The header's counts. Deliberately forgiving: this header now sits above the
 * race-morning check-in desk, so a database that is missing (local/preview) or
 * briefly unreachable degrades the five tiles to "—" rather than taking all
 * three tabs down with it.
 */
async function EventStats({ slug }: { slug: string }) {
  const roster = await readRosterStats(slug);
  const total = roster ? Object.values(roster).reduce((sum, n) => sum + n, 0) : "—";
  const stats: EventHeaderStat[] = [
    { label: "Total", value: total },
    { label: "Registered", value: roster ? roster.registered : "—" },
    { label: "Confirmed", value: roster ? roster.confirmed : "—" },
    { label: "Checked in", value: roster ? roster.checked_in : "—" },
    { label: "No-show", value: roster ? roster.no_show : "—" },
  ];
  return <AdminEventStats stats={stats} />;
}

async function readRosterStats(slug: string) {
  if (!process.env.DATABASE_URL) return null;
  try {
    return await getRosterStats(slug);
  } catch (error) {
    console.error(`[admin] roster stats for ${slug} failed; header shows no counts:`, error);
    return null;
  }
}
