import type { ReactNode } from "react";

import {
  assignBibAndCheckIn,
  assignPendingBib,
  markNoShow,
  revertToRegistered,
} from "@/features/admin/checkin-actions";
import { adminCard } from "@/features/admin/components/shell/admin-card";
import { AdminField } from "@/features/admin/components/shell/admin-field";
import { AdminPill } from "@/features/admin/components/shell/admin-pill";
import { ParticipationBadge } from "@/features/admin/components/shell/participation-badge";
import { holdsBib, type ParticipationStatus, type RosterRow } from "@/features/admin/events-data";
import { formatHeatTime } from "@/lib/events/heat-time";
import { cn } from "@/lib/utils";

import { awaitingBib } from "./race-morning";
import { DeskActionForm, deskButton, deskInput } from "./desk-ui";

/**
 * One searched-for runner, and everything the desk can do about them.
 *
 * The card has two faces, and telling them apart at a glance is the whole job:
 * **before** the press it is a bib field and a Check in button, **after** it is
 * the bib they are wearing, set large enough to read out loud. The left rule
 * carries the status colour — the same one `ParticipationBadge` uses for its dot —
 * so a stack of results reads as a column of states before any word is read.
 *
 * Every form here is the one that was here before: same action, same hidden
 * `locale` / `slug` / `registrationId` / `q`, same bib bounds, same disabled
 * conditions. Only the sizing and the arrangement are new — controls are 48px
 * and the card is one column until `sm`, because this is used standing up.
 *
 * `data-admin-runner-card` / `data-checked-in` are stable markers for
 * end-to-end checks.
 */

/** Left rule per status, matching `ParticipationBadge`'s dot colours. */
const STATUS_RULE: Record<ParticipationStatus, string> = {
  registered: "shadow-[inset_3px_0_0_var(--admin-line-2)]",
  confirmed: "shadow-[inset_3px_0_0_var(--admin-warn)]",
  checked_in: "shadow-[inset_3px_0_0_var(--admin-ok)]",
  no_show: "shadow-[inset_3px_0_0_var(--admin-accent)]",
};

export function RunnerCard({
  row,
  slug,
  locale,
  q,
  nextBib,
  pool,
  canCheckin,
}: {
  row: RosterRow;
  slug: string;
  locale: string;
  q: string;
  nextBib: number | null;
  pool: number;
  /**
   * Whether the reader may work the desk. A view-only admin gets the same card
   * — who this is, where they stand, which bib they hold — and none of the
   * presses, all of which are `checkin` actions.
   */
  canCheckin: boolean;
}) {
  const name = [row.firstName, row.lastName].filter(Boolean).join(" ") || row.name;
  const checkedIn = row.status === "checked_in";

  return (
    <li
      data-admin-runner-card={row.id}
      data-checked-in={checkedIn ? "true" : "false"}
      className={adminCard(cn("p-4 sm:p-5", STATUS_RULE[row.status]))}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 className="truncate font-sans text-[18px] font-semibold normal-case not-italic leading-tight tracking-[-0.01em] text-admin-ink">
            {name}
          </h2>
          <p className="mt-1 truncate text-[12.5px] text-admin-muted">
            {[row.email, row.club].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* The desk reads the heat off the card, so a runner can be told where
              to stand at the moment they are chipped. */}
          <AdminPill tone={row.heatNumber === null ? "muted" : "ink"}>
            {row.heatNumber === null
              ? "no heat"
              : `heat ${row.heatNumber}${
                  row.heatScheduledAt ? ` · ${formatHeatTime(row.heatScheduledAt)}` : ""
                }`}
          </AdminPill>
          <ParticipationBadge status={row.status} />
        </div>
      </div>

      {checkedIn ? (
        <CheckedIn
          row={row}
          slug={slug}
          locale={locale}
          q={q}
          nextBib={nextBib}
          canCheckin={canCheckin}
        />
      ) : canCheckin ? (
        <NotCheckedIn row={row} slug={slug} locale={locale} q={q} nextBib={nextBib} pool={pool} />
      ) : null}
    </li>
  );
}

/**
 * The pre-press face: the bib to be leased, and the press.
 *
 * The bib is pre-filled with the number pre-assigned in the heat builder when
 * the runner holds one, and the lowest free bib otherwise; it stays editable
 * either way — typing over it is the "this runner already has 42 pinned on"
 * case. No-show is deliberately on its own line, away from the thumb that is
 * aiming at Check in.
 */
function NotCheckedIn({
  row,
  slug,
  locale,
  q,
  nextBib,
  pool,
}: {
  row: RosterRow;
  slug: string;
  locale: string;
  q: string;
  nextBib: number | null;
  pool: number;
}) {
  return (
    <div className="mt-4 border-t border-admin-line pt-4">
      <DeskActionForm
        action={assignBibAndCheckIn}
        locale={locale}
        slug={slug}
        q={q}
        registrationId={row.id}
        className="flex items-end gap-2.5"
      >
        <AdminField label="Bib" className="w-[92px] shrink-0">
          <input
            className={deskInput("text-center")}
            name="bib"
            type="number"
            min={1}
            max={pool}
            placeholder={!holdsBib(row) && nextBib === null ? "none" : undefined}
            defaultValue={holdsBib(row) ? (row.bib ?? "") : (nextBib ?? "")}
          />
        </AdminField>
        <button type="submit" className={deskButton("primary", "flex-1 sm:flex-none sm:px-8")}>
          Check in
        </button>
      </DeskActionForm>

      <div className="mt-3 flex justify-end">
        <DeskActionForm action={markNoShow} locale={locale} slug={slug} q={q} registrationId={row.id}>
          <button type="submit" className={deskButton("quiet")}>
            No-show
          </button>
        </DeskActionForm>
      </div>
    </div>
  );
}

/**
 * The post-press face: the bib they are wearing, or why they have none yet.
 *
 * Three outcomes, and they are not the same thing (ADR 0003): holding a lease,
 * waiting for one because the pool was empty, or having run — in which case their
 * bib went back and must *not* be handed to them again.
 */
function CheckedIn({
  row,
  slug,
  locale,
  q,
  nextBib,
  canCheckin,
}: {
  row: RosterRow;
  slug: string;
  locale: string;
  q: string;
  nextBib: number | null;
  canCheckin: boolean;
}) {
  const holds = holdsBib(row);
  const waiting = awaitingBib(row);

  return (
    <div className="mt-4 border-t border-admin-line pt-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <BibPlate value={holds ? row.bib : null} tone={holds ? "ok" : waiting ? "warn" : "muted"}>
          {holds ? "leased" : waiting ? "pending" : "returned"}
        </BibPlate>
        <p className="min-w-[12ch] flex-1 text-[13px] leading-relaxed text-admin-ink-2">
          {holds
            ? "Wearing this bib now — it goes back to the pool when their heat is marked finished."
            : waiting
              ? "Present, but no bib was free. Hand them one as soon as a heat finishes."
              : `Ran in heat ${row.heatNumber} · bib ${row.bib ?? "—"} returned to the pool.`}
        </p>
      </div>

      {canCheckin ? (
      <div className="mt-4 flex flex-wrap items-center justify-end gap-2.5">
        {waiting ? (
          <DeskActionForm
            action={assignPendingBib}
            locale={locale}
            slug={slug}
            q={q}
            registrationId={row.id}
            className="flex-1 sm:flex-none"
          >
            <button
              type="submit"
              className={deskButton("primary", "w-full sm:w-auto")}
              disabled={nextBib === null}
            >
              {nextBib === null ? "No bib free" : `Assign bib ${nextBib}`}
            </button>
          </DeskActionForm>
        ) : null}
        <DeskActionForm
          action={revertToRegistered}
          locale={locale}
          slug={slug}
          q={q}
          registrationId={row.id}
        >
          <button type="submit" className={deskButton("quiet")}>
            Undo check-in
          </button>
        </DeskActionForm>
      </div>
      ) : null}
    </div>
  );
}

/**
 * The bib, big. This is the one value on the page that gets read out across a
 * noisy start area, so it is set at plate size rather than as a line of prose.
 */
function BibPlate({
  value,
  tone,
  children,
}: {
  value: number | null;
  tone: "ok" | "warn" | "muted";
  children: ReactNode;
}) {
  const ink = tone === "ok" ? "text-admin-ok" : tone === "warn" ? "text-admin-warn" : "text-admin-muted";

  return (
    <div className="flex min-w-[104px] flex-col items-center gap-1 rounded-admin border border-admin-line bg-admin-surface-2 px-4 py-2.5">
      {/* `leading-none` follows the size on purpose — see `DESK_CONTROL`. */}
      <span
        className={cn(
          "font-mono font-medium",
          value === null ? "text-[22px]" : "text-[34px]",
          "leading-none",
          ink,
        )}
      >
        {value === null ? "—" : value}
      </span>
      <span className="font-mono text-[9.5px] font-medium uppercase tracking-[0.16em] text-admin-muted">
        {children}
      </span>
    </div>
  );
}
