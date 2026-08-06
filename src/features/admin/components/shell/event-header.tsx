import type { ReactNode } from "react";

import { formatEventLongDate } from "@/lib/events/time";
import type { EventSummary } from "@/lib/events/types";

import { AdminStat } from "./admin-stat";
import { EventStatusBadge } from "./event-status-badge";

/** One tile in the header's stat row. `value` is "—" when the counts are unavailable. */
export type EventHeaderStat = { label: string; value: string | number };

/**
 * The shared header on every per-event admin page: which night this is, what
 * state the registry says it is in, how it stands, and the actions that belong
 * to the event rather than to one tab (the xlsx exports, the photos-live send).
 *
 * Rendered once by the event layout, so the three tabs no longer each restate
 * the event. The *name* is not repeated here — the topbar above already carries
 * it — so the heading is the date, which is what tells one night in the series
 * from another.
 *
 * `stats` is a slot rather than data so the layout can stream it: the counts are
 * a database read, and Next's layout guidance is that runtime data access in a
 * layout belongs in its own Suspense boundary.
 *
 * `data-admin-event-header` is a stable marker for end-to-end checks — a
 * streamed page cannot be told apart by status code (see the PRD's verification
 * note), so the assertions grep for content.
 */
export function AdminEventHeader({
  event,
  stats,
  actions,
}: {
  event: EventSummary;
  stats?: ReactNode;
  actions?: ReactNode;
}) {
  const timeWindow = event.timeRange ? `${event.timeRange.start}–${event.timeRange.end}` : null;

  return (
    <section
      data-admin-event-header={event.slug}
      className="rounded-admin-lg border border-admin-line bg-admin-surface p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h2 className="font-sans text-[19px] font-semibold normal-case not-italic leading-tight tracking-[-0.01em] text-admin-ink">
            {formatEventLongDate("en", event.date)}
          </h2>
          <p className="mt-1.5 truncate text-[12.5px] text-admin-muted">
            {[timeWindow, event.venue].filter(Boolean).join(" · ")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <EventStatusBadge status={event.status} />
          {actions}
        </div>
      </div>

      {stats ? <div className="mt-4">{stats}</div> : null}
    </section>
  );
}

/** The header's stat row. Five tiles, so the grid is sized for five. */
export function AdminEventStats({ stats }: { stats: EventHeaderStat[] }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
      {stats.map((stat) => (
        <AdminStat key={stat.label} label={stat.label} value={stat.value} />
      ))}
    </div>
  );
}

/** Same five boxes, shimmering, so the header does not resize when they land. */
export function AdminEventStatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5" role="status" aria-label="Loading counts">
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="h-[62px] animate-pulse rounded-admin border border-admin-line bg-admin-surface-2"
        />
      ))}
    </div>
  );
}
