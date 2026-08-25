import { setRequestLocale } from "next-intl/server";

import { requireAdmin } from "@/features/admin/action-helpers";
import { NoDatabaseNotice } from "@/features/admin/components/no-database-notice";
import { adminButton } from "@/features/admin/components/shell/admin-button";
import { AdminEmptyState } from "@/features/admin/components/shell/admin-empty-state";
import { AdminEyebrow } from "@/features/admin/components/shell/admin-eyebrow";
import { AdminPage } from "@/features/admin/components/shell/admin-page";
import { AdminStat } from "@/features/admin/components/shell/admin-stat";
import { EventStatusBadge } from "@/features/admin/components/shell/event-status-badge";
import { getRosterStats, type ParticipationStatus } from "@/features/admin/events-data";
import { userCan } from "@/lib/auth/user-session";
import { getIndividualEvents } from "@/lib/events/registry";
import { formatEventLongDate } from "@/lib/events/time";
import type { EventSummary } from "@/lib/events/types";
import { cn } from "@/lib/utils";
import { Link } from "@/i18n/navigation";

/** The four live statuses; their sum is the event's registration count. */
const STATUSES: ParticipationStatus[] = ["registered", "confirmed", "checked_in", "no_show"];

type RosterStats = Record<ParticipationStatus, number>;

/**
 * Landing page for the sidebar's Events group: one card per mile event with its
 * lifecycle state, how many have entered, how many are through the desk, and
 * links to that event's three operational surfaces.
 *
 * Almost read-only — the registry plus the existing per-event roster-stats read.
 * The two writes it offers, "New event" and the per-card Settings link, are both
 * `edit` surfaces, so they are gated here as well as by the actions behind them:
 * a viewer or a check-in volunteer is never handed a control that 404s.
 *
 * The frozen team event never appears: `getIndividualEvents` excludes it, and it
 * has no roster / heats / check-in pages to link to in the first place.
 */
export default async function AdminEventsIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const actor = await requireAdmin(locale);
  // Creating an event, and everything on an event's Settings tab, is an `edit`
  // act; the cards, counts and three operational links are the read every admin
  // level gets.
  const canEdit = userCan(actor, "edit");

  // Completed nights included, as in the sidebar: a race that has run keeps its
  // roster, heats and check-in pages, and its final counts are the record of it.
  const events = await getIndividualEvents();
  const hasDatabase = Boolean(process.env.DATABASE_URL);
  // One grouped count query per event, in parallel — the same read the roster
  // header uses, so the index adds no new data path.
  const stats = hasDatabase
    ? await Promise.all(events.map((event) => getRosterStats(event.slug)))
    : null;

  return (
    <AdminPage
      eyebrow="Admin"
      title="Events"
      actions={
        canEdit ? (
          <Link href="/admin/events/new" className={adminButton("primary")}>
            New event
          </Link>
        ) : null
      }
    >
      {hasDatabase ? null : (
        <div className="mb-5">
          <NoDatabaseNotice>see registration and check-in counts</NoDatabaseNotice>
        </div>
      )}

      {events.length === 0 ? (
        <AdminEmptyState title="No events yet">
          Events are rows in the <code>events</code> table — this index, the sidebar and the
          public site all read that one source, so creating one here takes effect without a
          deploy. If you expected events to be listed, the database read came back empty:
          check the server log before adding anything.
        </AdminEmptyState>
      ) : (
        <ul className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
          {events.map((event, index) => (
            <EventCard
              key={event.slug}
              event={event}
              stats={stats?.[index] ?? null}
              canEdit={canEdit}
            />
          ))}
        </ul>
      )}
    </AdminPage>
  );
}

/**
 * `stats` is `null` when there is no database configured: the card still renders
 * from whatever the event store returned, with the two counts reading "—" rather
 * than the page collapsing to a notice.
 */
function EventCard({
  event,
  stats,
  canEdit,
}: {
  event: EventSummary;
  stats: RosterStats | null;
  canEdit: boolean;
}) {
  const registrations = stats ? STATUSES.reduce((sum, status) => sum + stats[status], 0) : null;
  const timeWindow = event.timeRange ? `${event.timeRange.start}–${event.timeRange.end}` : null;

  return (
    <li
      className={cn(
        "flex flex-col rounded-admin-lg border border-admin-line bg-admin-surface p-4 transition-opacity",
        // A run night recedes rather than disappears, as in the sidebar and the
        // dashboard's series strip — but it comes back to full contrast the
        // moment you reach for it, so its three links are never dimmed controls.
        event.status === "completed" && "opacity-60 focus-within:opacity-100 hover:opacity-100",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <AdminEyebrow>{event.name}</AdminEyebrow>
          {/* Every event in the series shares one name, so the date is the heading. */}
          <h2 className="mt-1 truncate font-sans text-[16px] font-semibold normal-case not-italic leading-tight tracking-[-0.01em] text-admin-ink">
            {formatEventLongDate("en", event.date)}
          </h2>
        </div>
        <EventStatusBadge status={event.status} />
      </div>

      <p className="mt-1.5 truncate text-[12.5px] text-admin-muted">
        {[timeWindow, event.venue].filter(Boolean).join(" · ")}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <AdminStat label="Registrations" value={registrations ?? "—"} />
        <AdminStat label="Checked in" value={stats ? stats.checked_in : "—"} />
      </div>

      {/* `mt-auto` keeps the link rows aligned across a row of cards. */}
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
        <Link href={`/admin/events/${event.slug}`} className={adminButton("stroke")}>
          Roster
        </Link>
        <Link href={`/admin/events/${event.slug}/heats`} className={adminButton("stroke")}>
          Heats
        </Link>
        <Link href={`/admin/events/${event.slug}/checkin`} className={adminButton("primary")}>
          Check-in
        </Link>
        {/* Last, and quiet: the lifecycle, the details and the delete panel are
            reached for once, not worked from on the night. */}
        {canEdit ? (
          <Link href={`/admin/events/${event.slug}/settings`} className={adminButton("quiet")}>
            Settings
          </Link>
        ) : null}
      </div>
    </li>
  );
}
