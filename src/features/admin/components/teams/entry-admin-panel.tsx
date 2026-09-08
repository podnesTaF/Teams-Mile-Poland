import type { TeamEntryRow } from "@/db/schema/team-entries";
import type { UserTeamRow } from "@/db/schema/user-teams";
import { ADMIN_NOTE, ADMIN_TITLE, adminCard } from "@/features/admin/components/shell/admin-card";
import { AdminNotice } from "@/features/admin/components/shell/admin-notice";
import { AdminPill } from "@/features/admin/components/shell/admin-pill";
import { AdminStat } from "@/features/admin/components/shell/admin-stat";
import {
  CompositionEditor,
  type CompositionMember,
} from "@/features/admin/components/teams/composition-editor";
import { ADMIN_TEAM_CATEGORY_LABEL } from "@/features/admin/components/teams/labels";
import { EntryDeskControls, SwapForm, type SwapMember } from "@/features/admin/components/teams/swap-form";
import type { EntryMemberView } from "@/features/teams/entries";
import { STAGE_OPTIONS, type RaceRole } from "@/features/teams/rating-rules";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * One team entry as the desk works it (PRD #64 user stories 28–35): who is on
 * it, who has confirmed, the composition editor before check-in, the fixed
 * composition and the swap after it, and the two desk presses.
 *
 * A server component that hands three client islands finished data. The roster
 * itself is rendered here rather than inside the editor, so a `admin_viewer`
 * reading the page never receives a composition island at all — and so the
 * fields the islands *do* carry are the ones they act on and nothing more.
 *
 * The stage option's nominal split is spelled out next to it (`760 m + 849 m`)
 * because that is what the pair actually declared, and a desk reading back
 * "2 laps" to a manager wants the metres to check it against the rules.
 */

const ROLE_LABEL: Record<RaceRole, string> = { racer: "Racer", ace: "Ace", joker: "Joker" };

const HEAD_CELL =
  "px-3 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-admin-muted";
const CELL = "px-3 py-2.5 align-middle text-[13px] text-admin-ink-2";

/**
 * The number a seat is actually wearing.
 *
 * A **reserve never holds a bib** — the swap hands it to the runner coming in
 * and stamps `bib_returned_at` on the one going out. `event_registrations.bib`
 * is deliberately retained after a return so past results stay accurate
 * (ADR 0003), and `getEntryMembers` reports that column raw, so a swapped-out
 * reserve would otherwise read as wearing the number their replacement is now
 * on — the same number printed twice on one team. The reserve flag is the
 * authority here.
 */
function seatBib(member: EntryMemberView): number | null {
  return member.isReserve ? null : member.bib;
}

/** "Ace · pair 1 · 2 laps (760 m + 849 m)", or "Reserve". */
function seatLabel(member: EntryMemberView): string {
  if (member.isReserve || !member.raceRole) return "Reserve";
  const parts = [ROLE_LABEL[member.raceRole]];
  if (member.pairNo) parts.push(`pair ${member.pairNo}`);
  if (member.stageOption) {
    const stage = STAGE_OPTIONS[member.stageOption];
    parts.push(`${member.stageOption.replace("lap", " lap")} (${stage.aceM} m + ${stage.jokerM} m)`);
  }
  return parts.join(" · ");
}

export function EntryAdminPanel({
  entry,
  team,
  members,
  eventSlug,
  eventDate,
  heat,
  canCheckin,
  canEdit,
}: {
  entry: TeamEntryRow;
  team: UserTeamRow;
  members: EntryMemberView[];
  eventSlug: string;
  /** The race night as a calendar date — what age is judged against. */
  eventDate: Date;
  heat: { id: string; number: number; startedAt: Date | null; finishedAt: Date | null } | null;
  canCheckin: boolean;
  canEdit: boolean;
}) {
  const confirmed = members.filter((member) => member.confirmed).length;
  const checkedIn = entry.status !== "entered";
  const heatStarted = Boolean(heat?.startedAt || heat?.finishedAt);
  const composed = members.filter((member) => !member.isReserve && member.raceRole);
  const reserves = members.filter((member) => member.isReserve);

  const editorMembers: CompositionMember[] = members
    .filter((member) => !member.isReserve)
    .map((member) => ({
      userId: member.userId,
      displayName: member.displayName,
      sex: member.sex,
      dateOfBirth: member.dateOfBirth ? member.dateOfBirth.toISOString().slice(0, 10) : null,
      confirmed: member.confirmed,
      isReserve: member.isReserve,
      raceRole: member.raceRole,
      pairNo: member.pairNo,
      stageOption: member.stageOption,
    }));

  const toSwapMember = (member: EntryMemberView): SwapMember => ({
    userId: member.userId,
    displayName: member.displayName,
    label: `${member.displayName} — ${seatLabel(member)}${seatBib(member) ? ` · bib ${seatBib(member)}` : ""}`,
  });

  return (
    <div className="mt-5" data-team-entry-panel={entry.id}>
      <section className={adminCard("p-4 sm:p-5")}>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className={ADMIN_TITLE}>{team.name}</h2>
          <AdminPill tone="ink">{ADMIN_TEAM_CATEGORY_LABEL[entry.category]}</AdminPill>
          <AdminPill tone={checkedIn ? "ok" : "warn"} dot>
            {entry.status.replace("_", " ")}
          </AdminPill>
          {heat ? (
            <AdminPill tone={heatStarted ? "accent" : "muted"} dot>
              heat {heat.number}
              {heat.startedAt ? " · started" : heat.finishedAt ? " · finished" : ""}
            </AdminPill>
          ) : null}
        </div>

        <div className="mt-4 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
          <AdminStat label="Members" value={members.length} />
          <AdminStat label="Confirmed" value={`${confirmed}/${members.length}`} />
          <AdminStat label="Composed" value={composed.length} />
          <AdminStat label="Reserves" value={reserves.length} />
        </div>

        <p className={cn(ADMIN_NOTE, "mt-3 max-w-[78ch]")}>
          Rating rules <code className="font-mono text-admin-ink">{entry.ratingRulesVersion}</code> ·{" "}
          <Link href={`/admin/teams/${team.slug}`} className="text-admin-accent hover:underline">
            team page
          </Link>{" "}
          ·{" "}
          <Link href={`/teams/${team.slug}`} className="text-admin-accent hover:underline">
            public page
          </Link>
        </p>
      </section>

      {/* ── roster ─────────────────────────────────────────────────────── */}
      <section className={adminCard("mt-4 overflow-hidden")} data-team-entry-roster={members.length}>
        <header className="border-b border-admin-line px-4 py-3.5 sm:px-5">
          <h2 className={ADMIN_TITLE}>Entered runners</h2>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse">
            <thead>
              <tr className="border-b border-admin-line text-left">
                <th className={HEAD_CELL}>Runner</th>
                <th className={HEAD_CELL}>Sex</th>
                <th className={HEAD_CELL}>Confirmed</th>
                <th className={HEAD_CELL}>Seat</th>
                <th className={HEAD_CELL}>Bib</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr
                  key={member.userId}
                  className="border-b border-admin-line/60"
                  data-entry-member={member.userId}
                  data-entry-member-role={member.raceRole ?? "none"}
                  data-entry-member-pair={member.pairNo ?? ""}
                  data-entry-member-stage={member.stageOption ?? ""}
                  data-entry-member-reserve={member.isReserve ? "1" : "0"}
                  data-entry-member-bib={seatBib(member) ?? ""}
                >
                  <td className={cn(CELL, "text-admin-ink")}>{member.displayName}</td>
                  <td className={CELL}>{member.sex ?? "—"}</td>
                  <td className={CELL}>{member.confirmed ? "yes" : "pending"}</td>
                  <td className={CELL}>{seatLabel(member)}</td>
                  <td className={cn(CELL, "font-mono")}>{seatBib(member) ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {confirmed < members.length && !checkedIn ? (
        <AdminNotice className="mt-4">
          {members.length - confirmed} member(s) have not confirmed yet. A composition that names
          one of them is refused — the manager can resend their link from the entry page.
        </AdminNotice>
      ) : null}

      {checkedIn ? (
        <>
          <SwapForm
            entryId={entry.id}
            composed={composed.map(toSwapMember)}
            reserves={reserves.map(toSwapMember)}
            heatStarted={heatStarted}
            canCheckin={canCheckin}
          />
          <AdminNotice tone="info" className="mt-4">
            The composition is fixed. Adding, removing and withdrawing are refused from here and
            from the manager&rsquo;s entry page alike — a reserve swap is the only change left.
          </AdminNotice>
        </>
      ) : (
        <CompositionEditor
          entryId={entry.id}
          category={entry.category}
          members={editorMembers}
          eventDate={eventDate}
          canCheckin={canCheckin}
        />
      )}

      <EntryDeskControls
        entryId={entry.id}
        eventSlug={eventSlug}
        heatId={heat?.id ?? null}
        heatNumber={heat?.number ?? null}
        heatStarted={heatStarted}
        lockedByCheckIn={checkedIn}
        canCheckin={canCheckin}
        canEdit={canEdit}
      />
    </div>
  );
}
