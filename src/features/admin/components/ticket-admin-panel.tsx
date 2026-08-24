import {
  assignBibAndCheckIn,
  assignPendingBib,
  markNoShow,
  revertToRegistered,
} from "@/features/admin/checkin-actions";
import { checkinErrorText, checkinOkText } from "@/features/admin/checkin-copy";
import { ConfirmSubmit } from "@/features/admin/components/confirm-submit";
import { StatusPill } from "@/features/admin/components/status-pill";
import { getRosterRowById, holdsBib, suggestNextBib } from "@/features/admin/events-data";
import { formatAdminDateTime } from "@/features/admin/format";
import { formatHeatTime } from "@/lib/events/heat-time";
import { formatBibSlots } from "@/lib/events/bib-slots";
import { getBibSlots, getEventBySlug } from "@/lib/events/registry";
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
 * It carries the whole desk-side vocabulary for one runner (slice #45): check in
 * on the suggested bib or on a typed one, hand out a freed bib, mark a no-show,
 * and undo either. A volunteer working the phone should never have to leave a
 * scan to finish the person standing in front of them — the only things still
 * only at the desk are the ones that are not about *this* runner (search, the
 * waiting list, finishing heats).
 *
 * **Rendering this is not authorization.** The actions it posts enforce the admin
 * guard themselves, and reach the same `assignBibAndCheckIn` / `markNoShow` /
 * `revertToRegistered` the check-in desk does, through its `surface` token.
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

  // The issuable bibs — the event's slot list, or 1..pool (both reads share the
  // request-cached event snapshot). Count for the copy, highest number for the
  // input's `max`, spec so a refusal can name the list when one is set.
  const [slots, event] = await Promise.all([getBibSlots(slug), getEventBySlug(slug)]);
  const pool = slots.length;
  const bibMax = slots[slots.length - 1];
  const spec = event?.bibSlots ? formatBibSlots(slots) : undefined;
  const checkedIn = row.status === "checked_in";
  const holds = holdsBib(row);
  // Their heat has run: they are done, not waiting on a number (ADR 0003).
  const ran = checkedIn && !holds && row.heatFinishedAt !== null;
  const nextBib = holds ? null : await suggestNextBib(slug);

  const flash = ok ? checkinOkText(ok, heat) : checkinErrorText(error ?? "", { pool, spec });
  const name = [row.firstName, row.lastName].filter(Boolean).join(" ") || row.name;

  return (
    <section id="admin" className="tk-admin iv-no-print">
      <div className="tk-admin__head">
        <span className="tk-admin__eyebrow">Admin · check-in</span>
        <Link href={`/admin/events/${slug}/checkin`} className="btn btn-stroke btn-sm">
          Check-in desk
        </Link>
      </div>

      {flash ? (
        <div className="tk-admin__flashrow">
          <p className="tk-admin__flash">{flash}</p>
          {/* The loop: a check-in ends on this page, and the next runner is
              already holding out a phone. `ok` is only ever set by a successful
              action, so the button appears exactly on the success state. */}
          {ok ? (
            <Link href="/admin/scan" className="btn btn-red btn-sm">
              Scan next runner
            </Link>
          ) : null}
        </div>
      ) : null}

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
            </span>
            <div className="tk-admin__actions">
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
              {/* Undo throws away a check-in and the lease with it, so it is
                  confirmed — the desk's own idiom for a reversible-but-costly
                  press, and this one is a thumb's width from Scan next runner. */}
              <TicketActionForm
                action={revertToRegistered}
                locale={locale}
                registrationId={registrationId}
                sig={sig}
              >
                <ConfirmSubmit
                  label="Undo check-in"
                  title="Undo this check-in?"
                  message={
                    holds
                      ? `Bib ${row.bib} goes back to the pool and the runner is registered again, as if they had not arrived. Check them in again to hand out a number.`
                      : "The runner is registered again, as if they had not arrived. Check them in again to hand out a number."
                  }
                  confirmLabel="Undo check-in"
                  danger={false}
                  triggerClassName="btn btn-stroke btn-sm"
                />
              </TicketActionForm>
            </div>
          </>
        ) : (
          <>
            {/* The bib is pre-filled — with the number pinned on in the heat
                builder when there is one, the lowest free number otherwise — and
                stays editable: typing over it is the "this runner already has 42
                on their vest" case, which used to mean walking to the desk.
                Left blank (an exhausted pool) it leases nothing and the runner is
                checked in bib-less, ADR 0003. */}
            <TicketActionForm
              action={assignBibAndCheckIn}
              locale={locale}
              registrationId={registrationId}
              sig={sig}
              className="tk-admin__checkin"
            >
              <label className="tk-admin__bibfield">
                <span className="tk-admin__biblabel">Bib</span>
                <input
                  className="iv-input tk-admin__bibinput"
                  name="bib"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={bibMax}
                  placeholder={!holds && nextBib === null ? "none" : undefined}
                  defaultValue={holds ? (row.bib ?? "") : (nextBib ?? "")}
                />
              </label>
              <button type="submit" className="btn btn-red">
                Check in
              </button>
            </TicketActionForm>
            <span className="tk-admin__sub">
              {holds
                ? `Bib ${row.bib} was pre-assigned in the heat builder — checking in confirms it.`
                : nextBib === null
                  ? `All ${pool} bibs are out — leave this blank and they are checked in with a bib pending.`
                  : `Next free bib: ${nextBib}. Type over it to hand out a different number.`}
            </span>
            <div className="tk-admin__actions">
              {row.status === "no_show" ? (
                <TicketActionForm
                  action={revertToRegistered}
                  locale={locale}
                  registrationId={registrationId}
                  sig={sig}
                >
                  {/* Unmarking a no-show only restores what was there before, so
                      it is the one press here that is not confirmed. */}
                  <button type="submit" className="btn btn-stroke btn-sm">
                    Undo no-show
                  </button>
                </TicketActionForm>
              ) : (
                <TicketActionForm
                  action={markNoShow}
                  locale={locale}
                  registrationId={registrationId}
                  sig={sig}
                >
                  <ConfirmSubmit
                    label="Mark no-show"
                    title="Mark this runner a no-show?"
                    message="They are recorded as not having arrived. Undo it from here or from the desk if they turn up late."
                    confirmLabel="Mark no-show"
                    triggerClassName="btn btn-stroke btn-sm"
                  />
                </TicketActionForm>
              )}
            </div>
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
  className,
  children,
}: {
  action: (formData: FormData) => void | Promise<void>;
  locale: string;
  registrationId: string;
  sig: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <form action={action} className={className}>
      <input type="hidden" name="surface" value="ticket" />
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="registrationId" value={registrationId} />
      <input type="hidden" name="sig" value={sig} />
      {children}
    </form>
  );
}
