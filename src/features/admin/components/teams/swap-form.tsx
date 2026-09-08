"use client";

import { useMemo, useState, useTransition } from "react";

import { adminButton } from "@/features/admin/components/shell/admin-button";
import { ADMIN_NOTE, ADMIN_TITLE, adminCard } from "@/features/admin/components/shell/admin-card";
import { AdminField, adminInput } from "@/features/admin/components/shell/admin-field";
import { checkinRefusalText } from "@/features/admin/components/teams/composition-editor";
import { adminTeamRefusal } from "@/features/admin/components/teams/refusal";
import { markHeatStarted, swapComposed } from "@/features/teams/actions/checkin";
import { withdrawEntry } from "@/features/teams/actions/entries";
import { ConfirmButton } from "@/features/teams/components/confirm-button";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * The two presses a checked-in entry still takes at the desk (PRD #64 user
 * stories 33 and 35), plus the stamp that closes the first of them.
 *
 * They share one file because they share one situation: the team is checked in,
 * the composition is fixed, and the desk is reacting to the night — a runner
 * has not turned up, the heat has gone, the organiser refuses admission. All
 * three call actions that gate themselves (`checkin` for swap and mark-started,
 * `edit` for withdraw, which is the manager's own action under an admin
 * session), so hiding a control here is an offer and never the gate.
 *
 * `data-swap-form`, `data-swap-out`, `data-swap-in`, `data-swap-error`,
 * `data-heat-start`, `data-entry-admin-withdraw` are stable end-to-end markers.
 */

/** A member of a checked-in entry, as the swap needs them. */
export type SwapMember = { userId: string; displayName: string; label: string };

export function SwapForm({
  entryId,
  composed,
  reserves,
  heatStarted,
  canCheckin,
}: {
  entryId: string;
  /** Composed members — who can go out. */
  composed: SwapMember[];
  /** Reserves — who can come in. */
  reserves: SwapMember[];
  /** The entry's heat has been sent off (or finished): no swaps. */
  heatStarted: boolean;
  canCheckin: boolean;
}) {
  const router = useRouter();
  const [outUserId, setOutUserId] = useState(composed[0]?.userId ?? "");
  const [inUserId, setInUserId] = useState(reserves[0]?.userId ?? "");
  const [refused, setRefused] = useState<{ code: string; text: string } | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const nameOf = useMemo(() => {
    const byId = new Map(
      [...composed, ...reserves].map((member) => [member.userId, member.displayName]),
    );
    return (userId: string) => byId.get(userId) ?? userId;
  }, [composed, reserves]);

  function run() {
    if (pending || !outUserId || !inUserId) return;
    setRefused(null);
    setDone(null);
    startTransition(async () => {
      const result = await swapComposed(entryId, outUserId, inUserId);
      if (!result.ok) {
        setRefused({
          code: result.problem?.code ?? result.reason,
          text: checkinRefusalText(result, nameOf),
        });
        return;
      }
      setDone(
        `${nameOf(inUserId)} takes over from ${nameOf(outUserId)}` +
          `${result.bib === null ? " (no bib to move)" : `, wearing ${result.bib}`}.`,
      );
      router.refresh();
    });
  }

  return (
    <section className={adminCard("mt-4 p-4 sm:p-5")} data-swap-form={entryId}>
      <h2 className={ADMIN_TITLE}>Swap a reserve in</h2>
      <p className={cn(ADMIN_NOTE, "mt-1.5 max-w-[78ch]")}>
        The reserve inherits the role, the pair, the handover point, the bib and the heat. The
        composition is re-validated, so a swap can never produce a team that would have been
        refused at check-in. Allowed until the heat is marked started.
      </p>

      {heatStarted ? (
        <p className={cn(ADMIN_NOTE, "mt-3 text-admin-warn")} data-swap-form-state="heat_started">
          That heat has already started — the composition is what ran.
        </p>
      ) : reserves.length === 0 ? (
        <p className={cn(ADMIN_NOTE, "mt-3")} data-swap-form-state="no_reserves">
          Nobody is on this entry as a reserve, so there is nobody to swap in.
        </p>
      ) : !canCheckin ? (
        <p className={cn(ADMIN_NOTE, "mt-3")} data-swap-form-state="readonly">
          Read-only on this role. Swapping a runner needs the check-in role.
        </p>
      ) : (
        <div className="mt-4 flex flex-wrap items-end gap-2.5">
          <AdminField label="Out (absent)" className="w-full sm:w-[240px]">
            <select
              className={adminInput()}
              value={outUserId}
              disabled={pending}
              onChange={(e) => setOutUserId(e.target.value)}
              data-swap-out="1"
            >
              {composed.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.label}
                </option>
              ))}
            </select>
          </AdminField>
          <AdminField label="In (reserve)" className="w-full sm:w-[240px]">
            <select
              className={adminInput()}
              value={inUserId}
              disabled={pending}
              onChange={(e) => setInUserId(e.target.value)}
              data-swap-in="1"
            >
              {reserves.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.label}
                </option>
              ))}
            </select>
          </AdminField>
          <button
            type="button"
            className={adminButton("primary")}
            onClick={run}
            disabled={pending || !outUserId || !inUserId}
            data-swap-submit={entryId}
          >
            {pending ? "Swapping…" : "Swap"}
          </button>
        </div>
      )}

      {refused ? (
        <p
          className="mt-3 text-[12.5px] leading-relaxed text-admin-warn"
          role="alert"
          data-swap-error={refused.code}
        >
          {refused.text}
        </p>
      ) : null}
      {done ? (
        <p
          className="mt-3 text-[12.5px] leading-relaxed text-admin-ok"
          role="status"
          data-swap-done={entryId}
        >
          {done}
        </p>
      ) : null}
    </section>
  );
}

/**
 * Mark the entry's heat started, and withdraw the entry.
 *
 * Two different capabilities in one row, which is the point: the volunteer desk
 * role can say "they have gone" and can swap a reserve in, and only a full
 * admin can take a team out of the race (user story 35). Withdraw is the
 * manager's own `withdrawEntry` — the organiser's right to refuse admission is
 * the same action under a different session — so it is refused once the team is
 * checked in, exactly as it is for the manager (user story 13).
 */
export function EntryDeskControls({
  entryId,
  eventSlug,
  heatId,
  heatNumber,
  heatStarted,
  lockedByCheckIn,
  canCheckin,
  canEdit,
}: {
  entryId: string;
  eventSlug: string;
  /** The heat the team sits in, if any — what "Mark started" acts on. */
  heatId: string | null;
  heatNumber: number | null;
  heatStarted: boolean;
  /** The entry is `checked_in`, so withdraw is refused. */
  lockedByCheckIn: boolean;
  canCheckin: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [refused, setRefused] = useState<{ code: string; text: string } | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function start() {
    if (pending || !heatId) return;
    setRefused(null);
    setDone(null);
    startTransition(async () => {
      const heat = await markHeatStarted(heatId);
      if (!heat.ok) {
        setRefused({ code: heat.reason, text: adminTeamRefusal(heat.reason) });
        return;
      }
      setDone(`Heat ${heat.heatNumber} marked started — no more swaps in it.`);
      router.refresh();
    });
  }

  function withdraw() {
    if (pending) return;
    setRefused(null);
    setDone(null);
    startTransition(async () => {
      const result = await withdrawEntry(entryId);
      if (!result.ok) {
        setRefused({ code: result.reason, text: adminTeamRefusal(result.reason) });
        return;
      }
      router.push(`/admin/events/${eventSlug}/teams`);
      router.refresh();
    });
  }

  return (
    <section className={adminCard("mt-4 p-4 sm:p-5")} data-entry-desk-controls={entryId}>
      <h2 className={ADMIN_TITLE}>Desk</h2>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {canCheckin && heatId && !heatStarted ? (
          <button
            type="button"
            className={adminButton("stroke")}
            onClick={start}
            disabled={pending}
            data-heat-start={heatId}
          >
            Mark heat {heatNumber} started
          </button>
        ) : null}
        {canEdit ? (
          <ConfirmButton
            action="entry-admin-withdraw"
            target={entryId}
            variant="button"
            label="Withdraw entry"
            title="Withdraw this team?"
            message={
              lockedByCheckIn
                ? "This team is already checked in — the action will refuse. Revert the check-in first if the team really is out."
                : "The entry and every member registration are deleted, and every member is emailed. This cannot be undone."
            }
            confirmLabel="Withdraw"
            cancelLabel="Cancel"
            disabled={pending}
            onConfirm={withdraw}
          />
        ) : null}
      </div>
      <p className={cn(ADMIN_NOTE, "mt-3 max-w-[78ch]")}>
        {canEdit
          ? "Withdrawing is the organiser's right to refuse admission — the manager's own action under your session. It is refused once the team is checked in."
          : "Withdrawing a team needs full admin access, so it is not offered here."}
      </p>
      {refused ? (
        <p
          className="mt-3 text-[12.5px] leading-relaxed text-admin-warn"
          role="alert"
          data-desk-error={refused.code}
        >
          {refused.text}
        </p>
      ) : null}
      {done ? (
        <p className="mt-3 text-[12.5px] leading-relaxed text-admin-ok" role="status" data-desk-done="1">
          {done}
        </p>
      ) : null}
    </section>
  );
}
