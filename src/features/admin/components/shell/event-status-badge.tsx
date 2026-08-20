import type { EventStatus } from "@/lib/events/types";
import { cn } from "@/lib/utils";

/**
 * How a lifecycle status looks in the admin layer.
 *
 * The dot map is shared with the sidebar's event list so a race night reads the
 * same colour wherever it appears; the badge is its labelled form for cards and
 * headers.
 *
 * Everything here is client-safe on purpose. The sidebar is a client component
 * and needs the dot map and the label, so they cannot live in `admin-nav.ts`:
 * that module reads the event store and therefore imports the database driver,
 * which does not bundle for the browser.
 */

/** Human label for a lifecycle status, used as the status dot's tooltip. */
export function eventStatusLabel(status: EventStatus): string {
  return status.replaceAll("_", " ");
}

/**
 * `draft` is the only hollow dot: an unannounced night is not yet a real race,
 * so it reads as an outline rather than a colour.
 *
 * `cancelled` takes the admin layer's error tone, which is `--admin-accent`
 * (see `flash-banner.tsx`, where the `error` tone is that token) — there is no
 * separate danger token in the set declared on `.admin-root`, and adding one
 * would just be a second red.
 *
 * That forced `registration_closed` off accent and onto `--admin-info`, and it
 * is the right way round: closed means *entries shut, race still happening*,
 * which is informational, while cancelled means the night is off. Those two
 * reading the same is the exact confusion that made `cancelled` necessary —
 * the 2026-08-08 night was deleted from the registry outright because
 * `registration_closed` "read as a race still happening with entries shut".
 * Two states one colour apart would have reintroduced it visually.
 */
export const EVENT_STATUS_DOT: Record<EventStatus, string> = {
  draft: "border border-admin-line-2 bg-transparent",
  registration_open: "bg-admin-ok",
  upcoming: "bg-admin-warn",
  registration_closed: "bg-admin-info",
  completed: "bg-admin-muted",
  cancelled: "bg-admin-accent",
};

const STATUS_INK: Record<EventStatus, string> = {
  draft: "text-admin-muted",
  registration_open: "text-admin-ok",
  upcoming: "text-admin-warn",
  registration_closed: "text-admin-info",
  completed: "text-admin-muted",
  cancelled: "text-admin-accent",
};

export function EventStatusBadge({
  status,
  className,
}: {
  status: EventStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-pill border border-admin-line bg-admin-surface-2 px-2.5 py-1",
        "font-mono text-[10px] font-medium uppercase leading-none tracking-[0.14em]",
        STATUS_INK[status],
        className,
      )}
    >
      <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", EVENT_STATUS_DOT[status])} />
      {eventStatusLabel(status)}
    </span>
  );
}
