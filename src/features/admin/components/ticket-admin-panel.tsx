import { assignBibAndCheckIn, assignPendingBib } from "@/features/admin/checkin-actions";
import { checkedInText, checkinErrorText } from "@/features/admin/checkin-copy";
import { StatusPill } from "@/features/admin/components/status-pill";
import { getRosterRowById, holdsBib, suggestNextBib } from "@/features/admin/events-data";
import { formatAdminDateTime } from "@/features/admin/format";
import { formatHeatTime } from "@/lib/events/heat-time";
import { getBibPool } from "@/lib/events/registry";
import { Link } from "@/i18n/navigation";

/**
 * The inline admin panel on the participant's ticket page — the race-morning QR
 * scan path (PRD #26).
 *
 * The QR target URL is unchanged, because issued codes are baked into ticket
 * emails already sent and cannot be retargeted. So the ticket page grows this
 * panel instead: an admin session sees the runner's details and a Check in button,
 * and everyone else — including the ticket's owner — sees exactly the page they
 * saw before.
 *
 * **Rendering this is not authorization.** The actions it posts to enforce the
 * admin guard themselves, and reach the same `assignBibAndCheckIn` the check-in
 * desk does, through its `surface` token.
 *
 * English-only, like every other admin surface — a deliberate, documented
 * exception inside an otherwise participant-facing page.
 */
export async function TicketAdminPanel({
  registrationId,
  sig,
  locale,
  slug,
  ok,
  error,
  heat,
}: {
  registrationId: string;
  /** Ticket signature, carried through so the action can rebuild this URL. */
  sig: string;
  locale: string;
  slug: string;
  /** Flash codes, shared with the check-in desk. */
  ok?: string;
  error?: string;
  heat?: string;
}) {
  const row = await getRosterRowById(slug, registrationId);
  if (!row) return null;

  const pool = getBibPool(slug);
  const checkedIn = row.status === "checked_in";
  const holds = holdsBib(row);
  // Their heat has run: they are done, not waiting on a number (ADR 0003).
  const ran = checkedIn && !holds && row.heatFinishedAt !== null;
  const nextBib = holds ? null : await suggestNextBib(slug);

  const flash = ok ? checkedInText(ok, heat) : checkinErrorText(error ?? "", { pool });
  const name = [row.firstName, row.lastName].filter(Boolean).join(" ") || row.name;

  return (
    <section id="admin" className="tk-admin iv-no-print">
      <div className="tk-admin__head">
        <span className="tk-admin__eyebrow">Admin · check-in</span>
        <Link href={`/admin/events/${slug}/checkin`} className="btn btn-stroke btn-sm">
          Check-in desk
        </Link>
      </div>

      {flash ? <p className="tk-admin__flash">{flash}</p> : null}

      <div className="tk-admin__who">
        <strong>{name}</strong>
        <span className="tk-admin__sub">
          {row.email}
          {row.club ? ` · ${row.club}` : ""}
        </span>
        <span className="tk-admin__tags">
          <StatusPill status={row.status} />
          <span className="iv-pill">
            {row.heatNumber === null
              ? "no heat"
              : `heat ${row.heatNumber}${
                  row.heatScheduledAt ? ` · ${formatHeatTime(row.heatScheduledAt)}` : ""
                }`}
          </span>
        </span>
      </div>

      <div className="tk-admin__result">
        {checkedIn ? (
          <>
            {holds ? (
              <>
                <span className="tk-admin__biblabel">Bib</span>
                <span className="tk-admin__bib">{row.bib}</span>
              </>
            ) : (
              <span className="tk-admin__bib tk-admin__bib--pending">
                {ran ? "heat run" : "bib pending"}
              </span>
            )}
            <span className="tk-admin__sub">
              {ran
                ? `Ran in heat ${row.heatNumber} · bib ${row.bib ?? "—"} returned to the pool.`
                : `Checked in ${formatAdminDateTime(row.checkedInAt)}.`}
              {holds || ran ? " Undo from the check-in desk." : ""}
            </span>
            {holds || ran ? null : (
              <TicketActionForm
                action={assignPendingBib}
                locale={locale}
                registrationId={registrationId}
                sig={sig}
              >
                <button type="submit" className="btn btn-red btn-sm" disabled={nextBib === null}>
                  {nextBib === null ? "No bib free" : `Assign bib ${nextBib}`}
                </button>
              </TicketActionForm>
            )}
          </>
        ) : (
          <>
            <TicketActionForm
              action={assignBibAndCheckIn}
              locale={locale}
              registrationId={registrationId}
              sig={sig}
            >
              <button type="submit" className="btn btn-red">
                Check in
              </button>
            </TicketActionForm>
            <span className="tk-admin__sub">
              {holds
                ? `Bib ${row.bib} was pre-assigned in the heat builder — checking in confirms it.`
                : nextBib === null
                  ? `All ${pool} bibs are out — they will be checked in with a bib pending.`
                  : `Next free bib: ${nextBib}. Use the check-in desk to pick a different one.`}
            </span>
          </>
        )}
      </div>
    </section>
  );
}

/** A ticket-surface post: the panel has no slug, so `surface` + `sig` carry it. */
function TicketActionForm({
  action,
  locale,
  registrationId,
  sig,
  children,
}: {
  action: (formData: FormData) => void | Promise<void>;
  locale: string;
  registrationId: string;
  sig: string;
  children: React.ReactNode;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="surface" value="ticket" />
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="registrationId" value={registrationId} />
      <input type="hidden" name="sig" value={sig} />
      {children}
    </form>
  );
}
