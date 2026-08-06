import type { EventStatus } from "@/lib/events/types";
import { cn } from "@/lib/utils";

import { eventStatusLabel } from "./admin-nav";

/**
 * How a lifecycle status looks in the admin layer.
 *
 * The dot map is shared with the sidebar's event list so a race night reads the
 * same colour wherever it appears; the badge is its labelled form for cards and
 * headers.
 */

export const EVENT_STATUS_DOT: Record<EventStatus, string> = {
  registration_open: "bg-admin-ok",
  upcoming: "bg-admin-warn",
  registration_closed: "bg-admin-accent",
  completed: "bg-admin-muted",
};

const STATUS_INK: Record<EventStatus, string> = {
  registration_open: "text-admin-ok",
  upcoming: "text-admin-warn",
  registration_closed: "text-admin-accent",
  completed: "text-admin-muted",
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
