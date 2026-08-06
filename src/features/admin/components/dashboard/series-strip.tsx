import { AdminEyebrow } from "@/features/admin/components/shell/admin-eyebrow";
import { EventStatusBadge } from "@/features/admin/components/shell/event-status-badge";
import { formatEventDayMonth } from "@/lib/events/time";
import type { EventSummary } from "@/lib/events/types";
import { cn } from "@/lib/utils";
import { Link } from "@/i18n/navigation";

/**
 * The whole mile series at a glance, under the hero: every individual event —
 * completed nights included, dimmed — with its lifecycle state and how many have
 * entered, each row opening that event's roster.
 *
 * The frozen team event is never here: `getIndividualEvents` excludes it and it
 * has no per-event admin pages. `counts` is `null` when there is no database
 * configured, in which case the rows render from the registry alone.
 */
export function SeriesStrip({
  events,
  counts,
  featuredSlug,
}: {
  events: EventSummary[];
  counts: Map<string, number> | null;
  featuredSlug: string | null;
}) {
  return (
    <section aria-labelledby="series-strip-heading" className="mt-5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2
          id="series-strip-heading"
          className="font-sans text-[15px] font-semibold normal-case not-italic leading-tight text-admin-ink"
        >
          Mile series
        </h2>
        <Link
          href="/admin/events"
          className="text-[13px] font-medium text-admin-muted transition-colors hover:text-admin-ink"
        >
          All events →
        </Link>
      </div>

      {events.length === 0 ? (
        <p className="mt-3 text-[13px] text-admin-muted">No individual events configured.</p>
      ) : (
        <ul className="mt-3 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {events.map((event) => (
            <SeriesRow
              key={event.slug}
              event={event}
              count={counts?.get(event.slug) ?? null}
              featured={event.slug === featuredSlug}
              hasCounts={counts !== null}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function SeriesRow({
  event,
  count,
  featured,
  hasCounts,
}: {
  event: EventSummary;
  count: number | null;
  featured: boolean;
  hasCounts: boolean;
}) {
  const completed = event.status === "completed";

  return (
    <li>
      <Link
        href={`/admin/events/${event.slug}`}
        className={cn(
          "flex items-center gap-3 rounded-admin-lg border bg-admin-surface px-4 py-3 transition-colors hover:border-admin-line-2 hover:bg-admin-surface-2",
          featured ? "border-admin-accent" : "border-admin-line",
          // A run night recedes rather than disappears: its counts are the record
          // of the race, but the operational events are the ones to catch the eye.
          completed && !featured && "opacity-60",
        )}
      >
        <div className="min-w-0 flex-1">
          <p className="truncate font-sans text-[14.5px] font-semibold normal-case not-italic leading-tight text-admin-ink">
            {formatEventDayMonth("en", event.date)}
          </p>
          <AdminEyebrow className="mt-1">
            {featured ? "Featured · " : ""}
            {hasCounts ? `${count ?? 0} registered` : "Counts unavailable"}
          </AdminEyebrow>
        </div>
        <EventStatusBadge status={event.status} />
      </Link>
    </li>
  );
}
