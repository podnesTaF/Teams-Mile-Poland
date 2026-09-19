"use client";

import { useMemo, useState } from "react";

import { adminButton } from "@/features/admin/components/shell/admin-button";
import { ADMIN_NOTE, ADMIN_TITLE, adminCard } from "@/features/admin/components/shell/admin-card";
import { AdminField, adminInput } from "@/features/admin/components/shell/admin-field";
import { AdminPill } from "@/features/admin/components/shell/admin-pill";
import { ACTION_FAILED_TEXT, adminTeamRefusal } from "@/features/admin/components/teams/refusal";
import { checkInTeam, type CheckinFailure } from "@/features/teams/actions/checkin";
import type { TeamCategory } from "@/features/teams/config";
import {
  COMPOSITION,
  RACE_ROLES,
  STAGE_OPTIONS,
  STAGE_OPTION_KEYS,
  validateComposition,
  type CompositionProblem,
  type CompositionRow,
  type CompositionSeat,
  type RaceRole,
  type StageOption,
} from "@/features/teams/rating-rules";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { useActionRun } from "@/lib/use-action-run";

/**
 * The composition editor: the desk's one screen for the rules' check-in
 * procedure (PRD #64 user story 28) — a role per member, a pair number and the
 * pair's handover point for ACEs and JOKERs, and one press that fixes all of it.
 *
 * **The client validates with the very same function the action re-runs.**
 * `validateComposition` is pure, has no database and no clock, so it is
 * imported here directly rather than mirrored (user story 42): the manager
 * standing at the desk is told "two ACEs in pair 1" as they dictate it, and the
 * server re-judges the identical rows before writing anything. A client island
 * is never a trust boundary — it is a way to answer without a round-trip.
 *
 * Roles start **empty on purpose**. The rules place role selection at check-in
 * with the manager present, and a prefilled composition would be the platform
 * guessing at a decision it is supposed to be recording. An empty role is a
 * Reserve, which is exactly what "not named in the composition" means.
 *
 * `data-composition-editor` / `data-composition-row` / `data-composition-error`
 * / `data-team-checkin-status` are stable markers for end-to-end checks: a
 * streamed page cannot be told apart by status code.
 */

/** One member of the entry as the editor needs them. */
export type CompositionMember = {
  userId: string;
  displayName: string;
  sex: "M" | "F" | null;
  /** ISO date; the validator coerces it (`coerceToDate`) before comparing. */
  dateOfBirth: string | null;
  confirmed: boolean;
  isReserve: boolean;
  raceRole: RaceRole | null;
  pairNo: number | null;
  stageOption: StageOption | null;
};

type RowState = { role: RaceRole | ""; pairNo: "" | "1" | "2"; stageOption: StageOption | "" };

/** The English sentence for one composition sub-reason (user story 29). */
export function compositionProblemText(
  problem: CompositionProblem,
  nameOf: (userId: string) => string,
): string {
  switch (problem.code) {
    case "role_counts":
      return (
        `This category needs ${problem.expected.racers} RACERS and ${problem.expected.pairs} ` +
        `ACE+JOKER pairs — named so far: ${problem.got.racers} RACERS, ${problem.got.aces} ACEs, ` +
        `${problem.got.jokers} JOKERs.`
      );
    case "pair_shape":
      return problem.pairNo === 0
        ? "A pair member is missing its pair number or handover point, or a RACER has been given one."
        : `Pair ${problem.pairNo} must be exactly one ACE and one JOKER agreeing on one handover point.`;
    case "mixed_sex":
      return `${nameOf(problem.userId)} cannot run as ${problem.role.toUpperCase()} in a mixed team — RACERS are men and pairs are women.`;
    case "unconfirmed":
      return `${nameOf(problem.userId)} has not confirmed their participation yet — they must open their link and accept the team documents.`;
    case "underage":
      return `${nameOf(problem.userId)} is not 18 on the event date (or has no date of birth on file).`;
    case "duplicate":
      return `${nameOf(problem.userId)} is named twice.`;
    case "unknown_member":
      return `${nameOf(problem.userId)} is not on this entry.`;
  }
}

/** The refusal sentence for a check-in or swap, sub-reason included. */
export function checkinRefusalText(
  failure: CheckinFailure,
  nameOf: (userId: string) => string,
): string {
  if (failure.problem) return compositionProblemText(failure.problem, nameOf);
  return adminTeamRefusal(failure.reason);
}

export function CompositionEditor({
  entryId,
  category,
  members,
  eventDate,
  canCheckin,
}: {
  entryId: string;
  category: TeamCategory;
  /** Every member of the entry; reserves are excluded by the caller after check-in. */
  members: CompositionMember[];
  /** The race night as a calendar date — age is judged against it, never today. */
  eventDate: Date;
  /** Whether the reader holds `checkin`; false renders the editor read-only. */
  canCheckin: boolean;
}) {
  const router = useRouter();
  const rules = COMPOSITION[category];
  const [rows, setRows] = useState<Record<string, RowState>>(() =>
    Object.fromEntries(
      members.map((member) => [
        member.userId,
        {
          role: member.raceRole ?? "",
          pairNo: member.pairNo === 1 || member.pairNo === 2 ? (String(member.pairNo) as "1" | "2") : "",
          stageOption: member.stageOption ?? "",
        },
      ]),
    ),
  );
  const [refused, setRefused] = useState<{ code: string; text: string } | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, startTransition] = useActionRun(() =>
    setRefused({ code: "failed", text: ACTION_FAILED_TEXT }),
  );

  const nameOf = useMemo(() => {
    const byId = new Map(members.map((member) => [member.userId, member.displayName]));
    return (userId: string) => byId.get(userId) ?? userId;
  }, [members]);

  /** The composition as it currently stands — one row per named member. */
  const composition = useMemo<CompositionRow[]>(
    () =>
      members
        .filter((member) => rows[member.userId]?.role)
        .map((member) => {
          const state = rows[member.userId];
          const row: CompositionRow = { userId: member.userId, role: state.role as RaceRole };
          if (state.role !== "racer") {
            if (state.pairNo) row.pairNo = Number.parseInt(state.pairNo, 10) as 1 | 2;
            if (state.stageOption) row.stageOption = state.stageOption;
          }
          return row;
        }),
    [members, rows],
  );

  const seats = useMemo<CompositionSeat[]>(
    () =>
      members.map((member) => ({
        userId: member.userId,
        sex: member.sex,
        dateOfBirth: member.dateOfBirth,
        confirmed: member.confirmed,
      })),
    [members],
  );

  const verdict = useMemo(
    () => validateComposition(category, seats, composition, eventDate),
    [category, seats, composition, eventDate],
  );
  const clientProblem = verdict.ok ? null : verdict.problem;

  function set(userId: string, patch: Partial<RowState>) {
    setRefused(null);
    setDone(null);
    setRows((prev) => {
      const current = prev[userId];
      const next = { ...current, ...patch };
      // A RACER runs the whole mile alone: dropping back to `racer` clears the
      // pair fields, which the validator would otherwise report as a mistake.
      if (next.role === "racer" || next.role === "") {
        next.pairNo = "";
        next.stageOption = "";
      }
      return { ...prev, [userId]: next };
    });
  }

  function submit() {
    if (pending || clientProblem) return;
    setRefused(null);
    setDone(null);
    startTransition(async () => {
      const result = await checkInTeam(entryId, composition);
      if (!result.ok) {
        setRefused({
          code: result.problem?.code ?? result.reason,
          text: checkinRefusalText(result, nameOf),
        });
        return;
      }
      const bibs = result.leases
        .map((lease) => `${nameOf(lease.userId)} ${lease.bib ?? "pending"}`)
        .join(", ");
      setDone(
        `Checked in${result.heatNumber === null ? " — no published heat had room, place the team by hand" : ` into heat ${result.heatNumber}`}. ` +
          `Bibs: ${bibs}.` +
          (result.pending.length > 0
            ? ` ${result.pending.length} member(s) are bib-pending — free numbers by marking a finished heat complete.`
            : ""),
      );
      router.refresh();
    });
  }

  const named = composition.length;
  const expected = rules.racers + rules.pairs * 2;

  return (
    <section
      className={adminCard("mt-4 p-4 sm:p-5")}
      data-composition-editor={entryId}
      data-team-checkin-status={canCheckin ? "open" : "readonly"}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className={ADMIN_TITLE}>Race composition</h2>
        <AdminPill tone={named === expected ? (clientProblem ? "warn" : "ok") : "muted"} dot>
          {named}/{expected} named
        </AdminPill>
      </div>
      <p className={cn(ADMIN_NOTE, "mt-1.5 max-w-[78ch]")}>
        {rules.racers} RACERS and {rules.pairs} ACE+JOKER pairs
        {rules.racerSex ? ", RACERS men and pairs women" : ""}. Each pair declares one handover
        point — after about 1, 2 or 3 laps. Anyone left without a role becomes a reserve with no
        bib, and can be swapped in until the heat starts.
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[680px] border-collapse">
          <thead>
            <tr className="border-b border-admin-line text-left">
              <th className={HEAD_CELL}>Runner</th>
              <th className={HEAD_CELL}>Confirmed</th>
              <th className={HEAD_CELL}>Role</th>
              <th className={HEAD_CELL}>Pair</th>
              <th className={HEAD_CELL}>Handover</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => {
              const state = rows[member.userId];
              const paired = state.role === "ace" || state.role === "joker";
              return (
                <tr
                  key={member.userId}
                  className="border-b border-admin-line/60"
                  data-composition-row={member.userId}
                  data-composition-role={state.role || "reserve"}
                >
                  <td className={CELL}>
                    <span className="text-admin-ink">{member.displayName}</span>
                    <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.14em] text-admin-muted">
                      {member.sex ?? "—"}
                    </span>
                  </td>
                  <td className={CELL}>
                    <AdminPill tone={member.confirmed ? "ok" : "warn"} dot>
                      {member.confirmed ? "yes" : "pending"}
                    </AdminPill>
                  </td>
                  <td className={CELL}>
                    <AdminField label="" className="w-[132px]">
                      <select
                        className={adminInput()}
                        value={state.role}
                        disabled={!canCheckin || pending}
                        onChange={(e) => set(member.userId, { role: e.target.value as RaceRole | "" })}
                        data-composition-select="role"
                      >
                        <option value="">Reserve</option>
                        {RACE_ROLES.map((role) => (
                          <option key={role} value={role}>
                            {ROLE_LABEL[role]}
                          </option>
                        ))}
                      </select>
                    </AdminField>
                  </td>
                  <td className={CELL}>
                    <AdminField label="" className="w-[96px]">
                      <select
                        className={adminInput()}
                        value={state.pairNo}
                        disabled={!canCheckin || pending || !paired}
                        onChange={(e) =>
                          set(member.userId, { pairNo: e.target.value as "" | "1" | "2" })
                        }
                        data-composition-select="pair"
                      >
                        <option value="">—</option>
                        {Array.from({ length: rules.pairs }, (_, i) => String(i + 1)).map((n) => (
                          <option key={n} value={n}>
                            Pair {n}
                          </option>
                        ))}
                      </select>
                    </AdminField>
                  </td>
                  <td className={CELL}>
                    <AdminField label="" className="w-[164px]">
                      <select
                        className={adminInput()}
                        value={state.stageOption}
                        disabled={!canCheckin || pending || !paired}
                        onChange={(e) =>
                          set(member.userId, { stageOption: e.target.value as StageOption | "" })
                        }
                        data-composition-select="stage"
                      >
                        <option value="">—</option>
                        {STAGE_OPTION_KEYS.map((option) => (
                          <option key={option} value={option}>
                            {STAGE_LABEL[option]}
                          </option>
                        ))}
                      </select>
                    </AdminField>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {canCheckin ? (
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-admin-line pt-4">
          <button
            type="button"
            className={adminButton("primary")}
            onClick={submit}
            disabled={pending || Boolean(clientProblem)}
            data-team-checkin-submit={entryId}
          >
            {pending ? "Checking in…" : "Check in & lease bibs"}
          </button>
          {clientProblem ? (
            <span
              className="text-[12.5px] leading-relaxed text-admin-warn"
              role="alert"
              data-composition-error={clientProblem.code}
            >
              {compositionProblemText(clientProblem, nameOf)}
            </span>
          ) : null}
          {refused ? (
            <span
              className="text-[12.5px] leading-relaxed text-admin-warn"
              role="alert"
              data-composition-error={refused.code}
            >
              {refused.text}
            </span>
          ) : null}
          {done ? (
            <span
              className="text-[12.5px] leading-relaxed text-admin-ok"
              role="status"
              data-team-checkin-done={entryId}
            >
              {done}
            </span>
          ) : null}
        </div>
      ) : (
        <p className={cn(ADMIN_NOTE, "mt-4 border-t border-admin-line pt-4")}>
          Read-only on this role. Naming a composition and leasing bibs needs the check-in role —
          the action refuses it, so the press is not offered here.
        </p>
      )}
    </section>
  );
}

const HEAD_CELL =
  "px-3 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-admin-muted";
const CELL = "px-3 py-2 align-middle text-[13px] text-admin-ink-2";

const ROLE_LABEL: Record<RaceRole, string> = { racer: "Racer", ace: "Ace", joker: "Joker" };

/** "2 laps · ace 760 m" — the declared handover, with its nominal split. */
const STAGE_LABEL: Record<StageOption, string> = {
  "1lap": `1 lap · ace ${STAGE_OPTIONS["1lap"].aceM} m`,
  "2lap": `2 laps · ace ${STAGE_OPTIONS["2lap"].aceM} m`,
  "3lap": `3 laps · ace ${STAGE_OPTIONS["3lap"].aceM} m`,
};
