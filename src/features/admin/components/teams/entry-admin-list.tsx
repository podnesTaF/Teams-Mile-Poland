import { ADMIN_NOTE, ADMIN_TITLE, adminCard } from "@/features/admin/components/shell/admin-card";
import { AdminEmptyState } from "@/features/admin/components/shell/admin-empty-state";
import { AdminPill, type AdminPillTone } from "@/features/admin/components/shell/admin-pill";
import { ADMIN_TEAM_CATEGORY_LABEL } from "@/features/admin/components/teams/labels";
import type { EventEntrySummary } from "@/features/teams/entries";
import type { TeamEntryStatus } from "@/db/schema/team-entries";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * The desk's list of entered teams for one event (PRD #64 user story 27): who
 * has entered, how many of them have confirmed, whether they have been through
 * check-in, and which heat they sit in.
 *
 * A server component: it is a read, every level of admin may see it, and the
 * only interactive thing on it is a link to the entry. `?entry=<id>` rather
 * than a nested route, so the list stays on screen next to the entry being
 * worked on — the desk moves between teams, not between pages.
 *
 * `data-team-entry-list`, `data-team-entry`, `data-team-entry-status` and
 * `data-team-entry-confirmed` are the stable markers for end-to-end checks.
 */

/** Confirmation counts are the desk's readiness signal, so they are toned. */
function confirmationTone(confirmed: number, total: number): AdminPillTone {
  if (total === 0) return "muted";
  return confirmed === total ? "ok" : "warn";
}

const STATUS_TONE: Record<TeamEntryStatus, AdminPillTone> = {
  entered: "warn",
  checked_in: "ok",
  finished: "muted",
  dsq: "accent",
};

const HEAD_CELL =
  "px-3 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-admin-muted";
const CELL = "px-3 py-2.5 align-middle text-[13px] text-admin-ink-2";

export function EntryAdminList({
  eventSlug,
  entries,
  heatNumbers,
  selectedEntryId,
}: {
  eventSlug: string;
  entries: EventEntrySummary[];
  /** Heat number per heat id, so a seated team names its heat. */
  heatNumbers: Record<string, number>;
  selectedEntryId?: string;
}) {
  if (entries.length === 0) {
    return (
      <div data-team-entry-list="0">
        <AdminEmptyState title="No team has entered yet">
          Managers enter their own complete teams from the team page while registration is open.
          Each entry appears here with its confirmation count, ready to be checked in on the night.
        </AdminEmptyState>
      </div>
    );
  }

  return (
    <section className={adminCard("overflow-hidden")} data-team-entry-list={entries.length}>
      <header className="border-b border-admin-line px-4 py-3.5 sm:px-5">
        <h2 className={ADMIN_TITLE}>Entered teams ({entries.length})</h2>
        <p className={cn(ADMIN_NOTE, "mt-1 max-w-[78ch]")}>
          Confirmed counts every member who has accepted the team document set. Check-in refuses a
          composition that names anyone still pending, so a team is ready when its count is full.
        </p>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr className="border-b border-admin-line text-left">
              <th className={HEAD_CELL}>Team</th>
              <th className={HEAD_CELL}>Category</th>
              <th className={HEAD_CELL}>Confirmed</th>
              <th className={HEAD_CELL}>Status</th>
              <th className={HEAD_CELL}>Heat</th>
              <th className={HEAD_CELL} />
            </tr>
          </thead>
          <tbody>
            {entries.map(({ entry, team, total, confirmed }) => {
              const selected = entry.id === selectedEntryId;
              return (
                <tr
                  key={entry.id}
                  className={cn(
                    "border-b border-admin-line/60",
                    selected ? "bg-admin-surface-2" : undefined,
                  )}
                  data-team-entry={entry.id}
                  data-team-entry-team={team.slug}
                  data-team-entry-status={entry.status}
                  data-team-entry-confirmed={`${confirmed}/${total}`}
                >
                  <td className={cn(CELL, "text-admin-ink")}>{team.name}</td>
                  <td className={CELL}>{ADMIN_TEAM_CATEGORY_LABEL[entry.category]}</td>
                  <td className={CELL}>
                    <AdminPill tone={confirmationTone(confirmed, total)} dot>
                      {confirmed}/{total}
                    </AdminPill>
                  </td>
                  <td className={CELL}>
                    <AdminPill tone={STATUS_TONE[entry.status]} dot>
                      {entry.status.replace("_", " ")}
                    </AdminPill>
                  </td>
                  <td className={CELL}>
                    {entry.heatId ? (heatNumbers[entry.heatId] ?? "—") : "—"}
                  </td>
                  <td className={cn(CELL, "text-right")}>
                    <Link
                      href={`/admin/events/${eventSlug}/teams?entry=${entry.id}`}
                      className="font-mono text-[11px] uppercase tracking-[0.14em] text-admin-accent hover:underline"
                      data-team-entry-open={entry.id}
                    >
                      {selected ? "Open ✓" : "Open"}
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
