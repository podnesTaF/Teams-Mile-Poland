import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { requireAdmin } from "@/features/admin/action-helpers";
import { ADMIN_NOTE, ADMIN_TITLE, adminCard } from "@/features/admin/components/shell/admin-card";
import { AdminNotice } from "@/features/admin/components/shell/admin-notice";
import { AdminStat } from "@/features/admin/components/shell/admin-stat";
import { EntryAdminList } from "@/features/admin/components/teams/entry-admin-list";
import { EntryAdminPanel } from "@/features/admin/components/teams/entry-admin-panel";
import { getEventHeats } from "@/features/admin/heats-data";
import { getEntryMembers, listEntriesForEvent } from "@/features/teams/entries";
import { userCan } from "@/lib/auth/user-session";
import { parseDateOnly } from "@/lib/age";
import { getBibSlots, getEventBySlug } from "@/lib/events/registry";
import { acceptsTeams } from "@/lib/events/types";
import { cn } from "@/lib/utils";

/**
 * The Teams tab: the race-day desk for a team event (PRD #64 user story 38 —
 * "team check-in on the same desk surface as individual check-in").
 *
 * **Reads are `view`, presses are `checkin`, withdraw is `edit`.** The page
 * gates on `view` exactly as the individual check-in desk does, so an
 * `admin_viewer` watching the tab is a legitimate read; the composition editor,
 * the swap and the mark-started press are offered only to `checkin`, and
 * withdraw only to `edit`. Every action behind those controls re-checks its own
 * capability and answers a refusal, so hiding a control is an offer and never
 * the gate.
 *
 * `?entry=<id>` opens one entry beside the list rather than on its own route:
 * the desk moves between teams all evening, and the list is the thing it comes
 * back to.
 *
 * Individual events 404 here — their desk is the Check-in tab, and the Teams
 * tab is not even offered for them (`event-tabs.tsx`).
 */

type PageProps = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ entry?: string }>;
};

export default async function AdminEventTeamsPage({ params, searchParams }: PageProps) {
  const { locale, slug } = await params;
  const { entry: entryId } = await searchParams;
  setRequestLocale(locale);
  const actor = await requireAdmin(locale);
  const canCheckin = userCan(actor, "checkin");
  const canEdit = userCan(actor, "edit");

  const event = await getEventBySlug(slug);
  if (!acceptsTeams(event)) notFound();

  const [entries, heats, slots] = await Promise.all([
    listEntriesForEvent(slug),
    getEventHeats(slug),
    getBibSlots(slug),
  ]);

  const heatNumbers = Object.fromEntries(heats.map((heat) => [heat.id, heat.number]));
  const selected = entryId ? entries.find((row) => row.entry.id === entryId) : undefined;
  const members = selected ? await getEntryMembers(selected.entry.id) : [];
  const selectedHeat = selected?.entry.heatId
    ? (heats.find((heat) => heat.id === selected.entry.heatId) ?? null)
    : null;

  const checkedIn = entries.filter((row) => row.entry.status !== "entered").length;
  const ready = entries.filter(
    (row) => row.entry.status === "entered" && row.total > 0 && row.confirmed === row.total,
  ).length;
  const teamSeats = heats.reduce((sum, heat) => sum + heat.teamCapacity, 0);
  const publishedHeats = heats.filter((heat) => heat.state !== "draft").length;

  return (
    <div data-admin-teams-desk={slug} data-admin-teams-role={canCheckin ? "checkin" : "view"}>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
        <AdminStat label="Entries" value={entries.length} />
        <AdminStat label="Ready to check in" value={ready} />
        <AdminStat label="Checked in" value={checkedIn} />
        <AdminStat label="Heats" value={`${publishedHeats}/${heats.length}`} />
        <AdminStat label="Team seats" value={teamSeats} />
        <AdminStat label="Bib pool" value={slots.length} />
      </div>

      {heats.length === 0 ? (
        <AdminNotice className="mt-4">
          This event has no heats. Check-in still works — a team is checked in and left unplaced —
          but nothing seats it until a card is generated and published on the Heats tab.
        </AdminNotice>
      ) : publishedHeats === 0 ? (
        <AdminNotice className="mt-4">
          Every heat is still draft. Teams are seated into <em>published</em> heats only, so
          check-in will leave them unplaced until the card is released.
        </AdminNotice>
      ) : null}

      {!canCheckin ? (
        <AdminNotice tone="info" className="mt-4">
          Read-only on this role. Naming a composition, swapping a reserve and marking a heat
          started need the check-in role; withdrawing a team needs full admin access.
        </AdminNotice>
      ) : null}

      <div className="mt-4">
        <EntryAdminList
          eventSlug={slug}
          entries={entries}
          heatNumbers={heatNumbers}
          selectedEntryId={selected?.entry.id}
        />
      </div>

      {entryId && !selected ? (
        <section className={adminCard("mt-4 p-4 sm:p-5")} data-team-entry-missing={entryId}>
          <h2 className={ADMIN_TITLE}>That entry is not on this event</h2>
          <p className={cn(ADMIN_NOTE, "mt-1.5")}>
            It may have been withdrawn while this page was open. Pick a team from the list above.
          </p>
        </section>
      ) : null}

      {selected ? (
        <EntryAdminPanel
          entry={selected.entry}
          team={selected.team}
          members={members}
          eventSlug={slug}
          eventDate={parseDateOnly(event.date)}
          heat={selectedHeat}
          canCheckin={canCheckin}
          canEdit={canEdit}
        />
      ) : null}
    </div>
  );
}
