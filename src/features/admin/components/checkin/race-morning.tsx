import { assignPendingBib, markHeatFinished, unmarkHeatFinished } from "@/features/admin/checkin-actions";
import { ConfirmSubmit } from "@/features/admin/components/confirm-submit";
import { AdminPill } from "@/features/admin/components/shell/admin-pill";
import { ADMIN_NOTE } from "@/features/admin/components/shell/admin-card";
import { holdsBib, type RosterRow } from "@/features/admin/events-data";
import { formatAdminDateTime, plural } from "@/features/admin/format";
import type { HeatWithFill } from "@/features/admin/heats-data";
import { formatHeatTime } from "@/lib/events/heat-time";
import { Link } from "@/i18n/navigation";

import { DeskActionForm, DeskFact, DeskPanel, DeskRow, deskButton } from "./desk-ui";

/**
 * Whether a checked-in runner is actually waiting for a bib.
 *
 * Holding no lease is not the same as needing one: after a heat is marked
 * finished its runners keep `checked_in` with their numbers returned (ADR 0003).
 * They have run. Only someone whose heat is still to come — or who has no heat at
 * all — belongs on the waiting list.
 */
export function awaitingBib(row: Pick<RosterRow, "status" | "bib" | "bibReturnedAt" | "heatFinishedAt">): boolean {
  return row.status === "checked_in" && !holdsBib(row) && row.heatFinishedAt === null;
}

/** The anchor the bibs-exhausted banner sends the desk to. */
export const HEAT_DESK_ID = "heat-desk";

/**
 * The heat desk: every heat on the card with its field, the bibs its runners are
 * still holding, and the one press that returns them.
 *
 * Lives on the check-in page rather than the heat builder because this is a
 * race-morning act, not card-building — and because the desk is told to "mark a
 * finished heat complete" the moment the pool runs dry, which has to be reachable
 * without leaving the surface it was said on.
 *
 * A card per heat rather than a row in a table: six columns do not fit a phone,
 * and the only column that is ever *compared* across heats is the clock, which
 * leads each card.
 */
export function HeatDesk({
  locale,
  slug,
  heats,
}: {
  locale: string;
  slug: string;
  heats: HeatWithFill[];
}) {
  if (heats.length === 0) {
    return (
      <DeskPanel id={HEAT_DESK_ID} title="Heats">
        <p className={ADMIN_NOTE}>
          No heats yet — build the card in the{" "}
          <Link
            href={`/admin/events/${slug}/heats`}
            className="text-admin-ink-2 underline decoration-admin-line-2 underline-offset-2 hover:text-admin-ink"
          >
            heat builder
          </Link>
          . Check-in works without one; runners just arrive unplaced.
        </p>
      </DeskPanel>
    );
  }

  const bibsOut = heats.reduce((sum, h) => sum + h.bibsHeld, 0);

  return (
    <DeskPanel
      id={HEAT_DESK_ID}
      title="Heats"
      meta={`${plural(bibsOut, "bib")} out across the card`}
    >
      <ul className="flex flex-col gap-2.5">
        {heats.map((heat) => (
          <HeatCard key={heat.id} locale={locale} slug={slug} heat={heat} />
        ))}
      </ul>
    </DeskPanel>
  );
}

/** Draft / published / finished, in the order a heat moves through them. */
const HEAT_STATE_TONE: Record<HeatWithFill["state"], "warn" | "ok" | "muted"> = {
  draft: "warn",
  published: "ok",
  finished: "muted",
};

function HeatCard({
  locale,
  slug,
  heat,
}: {
  locale: string;
  slug: string;
  heat: HeatWithFill;
}) {
  return (
    <li
      data-desk-heat={heat.number}
      data-heat-state={heat.state}
      className="flex flex-col gap-3 rounded-admin border border-admin-line bg-admin-surface-2 p-3 sm:flex-row sm:items-center sm:gap-4"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex w-12 shrink-0 flex-col items-center rounded-admin border border-admin-line bg-admin-surface py-1.5">
          <span className="font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-admin-muted">
            heat
          </span>
          <span className="font-mono text-[18px] font-medium leading-none text-admin-ink">
            {heat.number}
          </span>
        </div>
        <div className="min-w-0">
          <p className="font-sans text-[15px] font-medium normal-case not-italic leading-tight text-admin-ink">
            {formatHeatTime(heat.scheduledAt)}
          </p>
          <p className="mt-1 truncate text-[12.5px] text-admin-muted">
            {heat.fill}/{heat.capacity} in the field · {plural(heat.bibsHeld, "bib")} out
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <AdminPill tone={HEAT_STATE_TONE[heat.state]} dot>
          {heat.state}
        </AdminPill>
        <HeatAction locale={locale} slug={slug} heat={heat} />
      </div>
    </li>
  );
}

/**
 * Finish / un-finish for one heat. A draft heat gets neither: nobody was told to
 * run it, so it cannot have been run — publish the card first.
 */
function HeatAction({
  locale,
  slug,
  heat,
}: {
  locale: string;
  slug: string;
  heat: HeatWithFill;
}) {
  if (heat.state === "draft") {
    return <span className="text-[12.5px] text-admin-muted">publish first</span>;
  }

  if (heat.state === "finished") {
    return (
      <DeskActionForm action={unmarkHeatFinished} locale={locale} slug={slug} heatId={heat.id}>
        <ConfirmSubmit
          label="Un-finish"
          title={`Un-finish heat ${heat.number}?`}
          message="Its runners get their bibs back. This is refused outright if any of those numbers has already been handed to someone else — two runners must never wear the same bib at once."
          confirmLabel="Un-finish"
          danger={false}
          triggerClassName={deskButton("quiet")}
        />
      </DeskActionForm>
    );
  }

  return (
    <DeskActionForm action={markHeatFinished} locale={locale} slug={slug} heatId={heat.id}>
      <ConfirmSubmit
        label={heat.bibsHeld > 0 ? `Finish · frees ${heat.bibsHeld}` : "Finish"}
        title={`Mark heat ${heat.number} finished?`}
        message={
          heat.bibsHeld > 0
            ? `${plural(heat.bibsHeld, "bib")} returns to the pool for the next heats. You can un-finish this while those numbers are still free.`
            : "Nobody in this heat is holding a bib, so nothing returns to the pool. It is marked finished for the record."
        }
        confirmLabel="Mark finished"
        danger={false}
        triggerClassName={deskButton(heat.bibsHeld > 0 ? "primary" : "stroke")}
      />
    </DeskActionForm>
  );
}

/**
 * The two lists the desk works off between scans.
 *
 * **Bib pending** — checked in but still waiting on a number, in arrival order, so
 * bibs are handed out in the order people turned up as heats finish.
 *
 * **Unplaced** — checked in and chipped but in no heat, because no published heat
 * had room. Being chipped never depends on heat insertion succeeding (PRD #26);
 * these are placed deliberately from the heat builder.
 */
export function RaceMorningLists({
  locale,
  slug,
  q,
  checkedIn,
  bibAvailable,
}: {
  locale: string;
  slug: string;
  /** Current search, carried through so an action returns to the same results. */
  q: string;
  checkedIn: RosterRow[];
  bibAvailable: boolean;
}) {
  // Arrival order: `getEventRoster` sorts by bib for the roster table, but a
  // waiting list is first-come-first-served.
  const byArrival = [...checkedIn].sort(
    (a, b) => (a.checkedInAt?.getTime() ?? 0) - (b.checkedInAt?.getTime() ?? 0),
  );
  const bibPending = byArrival.filter(awaitingBib);
  const unplaced = byArrival.filter((r) => r.heatId === null);

  return (
    <>
      <DeskPanel
        id="bib-pending"
        title="Bib pending"
        count={bibPending.length}
        countTone={bibPending.length > 0 ? "warn" : "muted"}
        meta={bibAvailable ? "Bibs are free — hand them out" : "Waiting on a finished heat"}
      >
        {bibPending.length === 0 ? (
          <p className={ADMIN_NOTE}>Nobody is waiting for a bib.</p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {bibPending.map((row) => (
              <DeskRow
                key={row.id}
                name={runnerName(row)}
                sub={row.club ?? undefined}
                facts={
                  <>
                    <DeskFact label="Heat">{row.heatNumber ?? "—"}</DeskFact>
                    <DeskFact label="Checked in">{formatAdminDateTime(row.checkedInAt)}</DeskFact>
                  </>
                }
                action={
                  <DeskActionForm
                    action={assignPendingBib}
                    locale={locale}
                    slug={slug}
                    q={q}
                    registrationId={row.id}
                    className="shrink-0"
                  >
                    <button
                      type="submit"
                      className={deskButton("primary", "w-full sm:w-auto")}
                      disabled={!bibAvailable}
                    >
                      Assign bib
                    </button>
                  </DeskActionForm>
                }
              />
            ))}
          </ul>
        )}
      </DeskPanel>

      <DeskPanel
        id="unplaced"
        title="Unplaced"
        count={unplaced.length}
        countTone={unplaced.length > 0 ? "warn" : "muted"}
        actions={
          unplaced.length > 0 ? (
            <Link href={`/admin/events/${slug}/heats`} className={deskButton("stroke")}>
              Place in heat builder
            </Link>
          ) : undefined
        }
        meta={
          unplaced.length === 0
            ? undefined
            : "Checked in and chipped, but no published heat had room. Place them from the heat builder — or add a heat and they land in the next auto-placement."
        }
      >
        {unplaced.length === 0 ? (
          <p className={ADMIN_NOTE}>Everyone checked in has a heat.</p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {unplaced.map((row) => (
              <DeskRow
                key={row.id}
                name={runnerName(row)}
                sub={row.club ?? undefined}
                facts={
                  <>
                    <DeskFact label="Bib">{holdsBib(row) ? row.bib : "pending"}</DeskFact>
                    <DeskFact label="Checked in">{formatAdminDateTime(row.checkedInAt)}</DeskFact>
                  </>
                }
              />
            ))}
          </ul>
        )}
      </DeskPanel>
    </>
  );
}

function runnerName(row: RosterRow): string {
  return [row.firstName, row.lastName].filter(Boolean).join(" ") || row.name;
}
