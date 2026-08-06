import { adminButton } from "@/features/admin/components/shell/admin-button";
import { AdminEmptyState } from "@/features/admin/components/shell/admin-empty-state";
import { AdminEyebrow } from "@/features/admin/components/shell/admin-eyebrow";
import { EventStatusBadge } from "@/features/admin/components/shell/event-status-badge";
import type { ParticipationStatus } from "@/features/admin/events-data";
import { formatEventLongDate } from "@/lib/events/time";
import type { EventSummary } from "@/lib/events/types";
import { Link } from "@/i18n/navigation";

/**
 * The dashboard's hero: the event the panel is currently *about* — the registry's
 * featured selection (the soonest night still taking entries, else the soonest
 * not-yet-run one) — with its lifecycle state, how the field is progressing, and
 * one click to each of its three operational surfaces.
 *
 * `stats` is `null` when there is no database configured; the card still renders
 * from the registry with the counts reading "—", as the events index does.
 */

/** The four live statuses; their sum is the event's registration count. */
const STATUSES: ParticipationStatus[] = ["registered", "confirmed", "checked_in", "no_show"];

type RosterStats = Record<ParticipationStatus, number>;

export function FeaturedEventCard({
  event,
  stats,
}: {
  event: EventSummary | null;
  stats: RosterStats | null;
}) {
  if (!event) {
    return (
      <AdminEmptyState title="No event coming up">
        Every event in the series has been run. Completed nights keep their roster, heats and
        check-in pages — open one from <strong>Events</strong> in the sidebar. A new night is a
        registry entry, not a row.
      </AdminEmptyState>
    );
  }

  const registrations = stats ? STATUSES.reduce((sum, status) => sum + stats[status], 0) : null;
  const timeWindow = event.timeRange ? `${event.timeRange.start}–${event.timeRange.end}` : null;

  return (
    <section
      aria-labelledby="featured-event-heading"
      className="rounded-admin-lg border border-admin-line bg-admin-surface p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          {/* Always "next": the registry only ever features a not-yet-run event. */}
          <AdminEyebrow>Next event</AdminEyebrow>
          <h2
            id="featured-event-heading"
            className="mt-1.5 font-sans text-[22px] font-semibold normal-case not-italic leading-tight tracking-[-0.02em] text-admin-ink sm:text-[26px]"
          >
            {formatEventLongDate("en", event.date)}
          </h2>
          <p className="mt-1.5 text-[13px] text-admin-muted">
            {[event.name, timeWindow, event.venue].filter(Boolean).join(" · ")}
          </p>
        </div>
        <EventStatusBadge status={event.status} />
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <HeroCount label="Registrations" value={registrations ?? "—"} accent />
        <HeroCount label="Awaiting confirmation" value={stats ? stats.registered : "—"} />
        <HeroCount label="Confirmed" value={stats ? stats.confirmed : "—"} />
        <HeroCount label="Checked in" value={stats ? stats.checked_in : "—"} />
      </dl>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Link href={`/admin/events/${event.slug}`} className={adminButton("stroke")}>
          Roster
        </Link>
        <Link href={`/admin/events/${event.slug}/heats`} className={adminButton("stroke")}>
          Heats
        </Link>
        <Link href={`/admin/events/${event.slug}/checkin`} className={adminButton("primary")}>
          Check-in
        </Link>
      </div>
    </section>
  );
}

/**
 * A count inside the hero. Its own shape rather than `AdminStat`: these are a
 * definition list describing one event, and the registration total is the number
 * the page leads with, so it gets the accent treatment.
 */
function HeroCount({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div className="rounded-admin border border-admin-line bg-admin-surface-2 px-3.5 py-3">
      <dt className="truncate font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-admin-muted">
        {label}
      </dt>
      <dd
        className={
          accent
            ? "mt-1.5 font-sans text-[28px] font-semibold normal-case not-italic leading-none tracking-[-0.02em] text-admin-accent"
            : "mt-1.5 font-sans text-[28px] font-semibold normal-case not-italic leading-none tracking-[-0.02em] text-admin-ink"
        }
      >
        {value}
      </dd>
    </div>
  );
}
