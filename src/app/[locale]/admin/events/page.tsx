import { setRequestLocale } from "next-intl/server";

import { requireAdmin } from "@/features/admin/action-helpers";
import { AdminEyebrow } from "@/features/admin/components/shell/admin-eyebrow";
import { eventStatusLabel } from "@/features/admin/components/shell/admin-nav";
import { AdminPage } from "@/features/admin/components/shell/admin-page";
import { getIndividualEvents } from "@/lib/events/registry";
import { Link } from "@/i18n/navigation";

/**
 * Landing page for the sidebar's Events group: every mile event with its
 * status and links to its three surfaces.
 *
 * A registry-only stub on purpose — the designed events index with per-event
 * registration and check-in counts is its own slice (#38). It exists now so the
 * shell's "All events" link has somewhere to go.
 */
export default async function AdminEventsIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdmin(locale);

  const events = getIndividualEvents();

  return (
    <AdminPage title="Events" eyebrow="Admin">
      {events.length === 0 ? (
        <p className="text-[13.5px] text-admin-muted">No individual events configured.</p>
      ) : (
        <ul className="space-y-2.5">
          {events.map((event) => (
            <li
              key={event.slug}
              className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-admin-lg border border-admin-line bg-admin-surface px-4 py-3.5"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14.5px] font-semibold text-admin-ink">
                  {event.name} · {event.shortDate}
                </p>
                <AdminEyebrow className="mt-0.5">{eventStatusLabel(event.status)}</AdminEyebrow>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/admin/events/${event.slug}`} className="btn btn-stroke btn-sm">
                  Roster
                </Link>
                <Link href={`/admin/events/${event.slug}/heats`} className="btn btn-stroke btn-sm">
                  Heats
                </Link>
                <Link href={`/admin/events/${event.slug}/checkin`} className="btn btn-red btn-sm">
                  Check-in
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </AdminPage>
  );
}
