import {
  assignPendingBib,
  markHeatFinished,
  unmarkHeatFinished,
} from "@/features/admin/checkin-actions";
import { ConfirmSubmit } from "@/features/admin/components/confirm-submit";
import { holdsBib, type RosterRow } from "@/features/admin/events-data";
import { formatAdminDateTime, plural } from "@/features/admin/format";
import type { HeatWithFill } from "@/features/admin/heats-data";
import { formatHeatTime } from "@/lib/events/heat-time";
import { Link } from "@/i18n/navigation";

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

/**
 * The heat desk: every heat on the card with its field, the bibs its runners are
 * still holding, and the one press that returns them.
 *
 * Lives on the check-in page rather than the heat builder because this is a
 * race-morning act, not card-building — and because the desk is told to "mark a
 * finished heat complete" the moment the pool runs dry, which has to be reachable
 * without leaving the surface it was said on.
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
      <section className="iv-card" style={{ marginTop: 16 }}>
        <h2 className="iv-section-title">Heats</h2>
        <p className="iv-note" style={{ marginTop: 6 }}>
          No heats yet — build the card in the{" "}
          <Link href={`/admin/events/${slug}/heats`} className="iv-linkbtn">
            heat builder
          </Link>
          . Check-in works without one; runners just arrive unplaced.
        </p>
      </section>
    );
  }

  const bibsOut = heats.reduce((sum, h) => sum + h.bibsHeld, 0);

  return (
    <section className="iv-card" style={{ marginTop: 16 }}>
      <div className="iv-section-head">
        <h2 className="iv-section-title">Heats</h2>
        <span className="iv-sub">{plural(bibsOut, "bib")} out across the card</span>
      </div>

      <div className="iv-tablewrap" style={{ marginTop: 12 }}>
        <table className="iv-table">
          <thead>
            <tr>
              <th>Heat</th>
              <th>Start</th>
              <th>State</th>
              <th>Field</th>
              <th>Bibs out</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {heats.map((heat) => (
              <tr key={heat.id}>
                <td>{heat.number}</td>
                <td>{formatHeatTime(heat.scheduledAt)}</td>
                <td>
                  <span
                    className={`iv-pill ${
                      heat.state === "finished"
                        ? "iv-pill--ok"
                        : heat.state === "published"
                          ? ""
                          : "iv-pill--due"
                    }`}
                  >
                    {heat.state}
                  </span>
                </td>
                <td>
                  {heat.fill}/{heat.capacity}
                </td>
                <td>{heat.bibsHeld}</td>
                <td>
                  <HeatAction locale={locale} slug={slug} heat={heat} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
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
    return <span className="iv-note">publish first</span>;
  }

  if (heat.state === "finished") {
    return (
      <form action={unmarkHeatFinished}>
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="heatId" value={heat.id} />
        <ConfirmSubmit
          label="Un-finish"
          title={`Un-finish heat ${heat.number}?`}
          message="Its runners get their bibs back. This is refused outright if any of those numbers has already been handed to someone else — two runners must never wear the same bib at once."
          confirmLabel="Un-finish"
          danger={false}
        />
      </form>
    );
  }

  return (
    <form action={markHeatFinished}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="heatId" value={heat.id} />
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
      />
    </form>
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
      <section className="iv-card" style={{ marginTop: 16 }}>
        <div className="iv-section-head">
          <div className="iv-inline" style={{ gap: 10, alignItems: "baseline" }}>
            <h2 className="iv-section-title">Bib pending</h2>
            <span className="iv-pill iv-pill--due">{bibPending.length}</span>
          </div>
          <span className="iv-sub">
            {bibAvailable ? "Bibs are free — hand them out" : "Waiting on a finished heat"}
          </span>
        </div>

        {bibPending.length === 0 ? (
          <p className="iv-note" style={{ marginTop: 8 }}>
            Nobody is waiting for a bib.
          </p>
        ) : (
          <div className="iv-tablewrap" style={{ marginTop: 12 }}>
            <table className="iv-table">
              <thead>
                <tr>
                  <th>Runner</th>
                  <th>Heat</th>
                  <th>Checked in</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {bibPending.map((row) => (
                  <tr key={row.id}>
                    <td>
                      {runnerName(row)}
                      <div className="iv-cellsub">{row.club ?? ""}</div>
                    </td>
                    <td>{row.heatNumber ?? "—"}</td>
                    <td>{formatAdminDateTime(row.checkedInAt)}</td>
                    <td>
                      <form action={assignPendingBib}>
                        <input type="hidden" name="locale" value={locale} />
                        <input type="hidden" name="slug" value={slug} />
                        <input type="hidden" name="registrationId" value={row.id} />
                        <input type="hidden" name="q" value={q} />
                        <button type="submit" className="btn btn-red btn-sm" disabled={!bibAvailable}>
                          Assign bib
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="iv-card" style={{ marginTop: 16 }}>
        <div className="iv-section-head">
          <div className="iv-inline" style={{ gap: 10, alignItems: "baseline" }}>
            <h2 className="iv-section-title">Unplaced</h2>
            <span className="iv-pill iv-pill--due">{unplaced.length}</span>
          </div>
          {unplaced.length > 0 ? (
            <Link href={`/admin/events/${slug}/heats`} className="btn btn-stroke btn-sm">
              Place in heat builder
            </Link>
          ) : null}
        </div>

        {unplaced.length === 0 ? (
          <p className="iv-note" style={{ marginTop: 8 }}>
            Everyone checked in has a heat.
          </p>
        ) : (
          <>
            <p className="iv-note" style={{ marginTop: 8 }}>
              Checked in and chipped, but no published heat had room. Place them from the heat
              builder — or add a heat and they land in the next auto-placement.
            </p>
            <div className="iv-tablewrap" style={{ marginTop: 12 }}>
              <table className="iv-table">
                <thead>
                  <tr>
                    <th>Runner</th>
                    <th>Bib</th>
                    <th>Checked in</th>
                  </tr>
                </thead>
                <tbody>
                  {unplaced.map((row) => (
                    <tr key={row.id}>
                      <td>
                        {runnerName(row)}
                        <div className="iv-cellsub">{row.club ?? ""}</div>
                      </td>
                      <td>{holdsBib(row) ? row.bib : "pending"}</td>
                      <td>{formatAdminDateTime(row.checkedInAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </>
  );
}

function runnerName(row: RosterRow): string {
  return [row.firstName, row.lastName].filter(Boolean).join(" ") || row.name;
}
