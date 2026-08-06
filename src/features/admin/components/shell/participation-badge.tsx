import type { ParticipationStatus } from "@/features/admin/events-data";
import { cn } from "@/lib/utils";

/**
 * How a runner's participation status looks in the admin layer — what
 * `StatusPill` (`.iv-pill`) is on the pages that have not been redesigned yet.
 *
 * Built rather than reused because the `.iv-*` vocabulary is frozen for admin
 * (ADR 0004) and this sits inside a redesigned table; `StatusPill` stays exactly
 * where it is, including on the *public* ticket page, which is not admin chrome
 * at all. The colour language is `EventStatusBadge`'s, one level down: a dot
 * plus mono caps, so a lifecycle status and a participation status read as the
 * same family without being the same size.
 *
 * The mapping is the desk's, not the schema's: green is "through the desk",
 * amber is "expected but not here yet", red is the exception.
 */

const DOT: Record<ParticipationStatus, string> = {
  registered: "bg-admin-muted",
  confirmed: "bg-admin-warn",
  checked_in: "bg-admin-ok",
  no_show: "bg-admin-accent",
};

const INK: Record<ParticipationStatus, string> = {
  registered: "text-admin-muted",
  confirmed: "text-admin-warn",
  checked_in: "text-admin-ok",
  no_show: "text-admin-accent",
};

export function ParticipationBadge({
  status,
  className,
}: {
  status: ParticipationStatus;
  className?: string;
}) {
  return (
    <span
      data-participation={status}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-pill border border-admin-line bg-admin-surface-2 px-2 py-0.5",
        "font-mono text-[10px] font-medium uppercase leading-[1.6] tracking-[0.1em]",
        INK[status],
        className,
      )}
    >
      <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", DOT[status])} />
      {status.replaceAll("_", " ")}
    </span>
  );
}
