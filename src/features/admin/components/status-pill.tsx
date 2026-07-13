import type { ParticipationStatus } from "@/features/admin/events-data";

export function StatusPill({ status }: { status: ParticipationStatus }) {
  const cls =
    status === "checked_in"
      ? "iv-pill--ok"
      : status === "no_show"
        ? "iv-pill--red"
        : "iv-pill--due";
  return <span className={`iv-pill ${cls}`}>{status.replaceAll("_", " ")}</span>;
}
