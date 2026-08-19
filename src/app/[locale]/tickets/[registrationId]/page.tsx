import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import "@/app/landing.css";

import { InteriorHeader } from "@/components/landing/interior-header";
import { TicketAdminPanel } from "@/features/admin/components/ticket-admin-panel";
import {
  loadEventRegistration,
  publishedHeatsByRegistration,
} from "@/features/event-registration/data";
import {
  ConfirmAttendanceForm,
  confirmNotice,
} from "@/features/event-registration/components/confirm-attendance-form";
import {
  awaitingConfirmation,
  isConfirmationOpen,
  slugsWithPublishedHeats,
} from "@/features/event-registration/confirmation";
import { buildEventTicketView, makeEventTicketUrl } from "@/features/event-registration/ticket";
import { generateTicketQrPng } from "@/features/ticket/qr";
import { verifyEventTicket } from "@/features/ticket/sign";
import { DownloadTicketButton } from "@/features/ticket/components/download-ticket-button";
import { Link } from "@/i18n/navigation";
import { getAdminUser, userCan } from "@/lib/auth/user-session";
import { formatHeatTime } from "@/lib/events/heat-time";
import { getEventBySlug } from "@/lib/events/registry";

type PageProps = {
  params: Promise<{ locale: string; registrationId: string }>;
  /** `ok` / `error` / `heat` are the admin panel's flash codes, shared with the
   * check-in desk; see {@link TicketAdminPanel}. */
  searchParams: Promise<{ s?: string; c?: string; ok?: string; error?: string; heat?: string }>;
};

export default async function EventTicketPage({ params, searchParams }: PageProps) {
  const { locale, registrationId } = await params;
  const { s, c, ok, error, heat: heatFlash } = await searchParams;
  setRequestLocale(locale);

  if (!s || !verifyEventTicket(registrationId, s)) {
    notFound();
  }

  const loaded = await loadEventRegistration(registrationId);
  if (!loaded) {
    notFound();
  }

  const event = getEventBySlug(loaded.registration.eventSlug);
  const view = buildEventTicketView(loaded.registration, loaded.user, event);

  const qrBuffer = await generateTicketQrPng(makeEventTicketUrl(registrationId, { locale }));
  const qrDataUri = `data:image/png;base64,${qrBuffer.toString("base64")}`;

  // Confirmation: the passwordless escape hatch. The signature already verified
  // above is what authorizes it, so a signed-out guest can answer from here.
  const published = await slugsWithPublishedHeats([loaded.registration.eventSlug]);
  const canConfirm =
    awaitingConfirmation(loaded.registration) &&
    isConfirmationOpen({
      event,
      now: new Date(),
      heatsPublished: published.has(loaded.registration.eventSlug),
    });
  const notice = confirmNotice(c);
  const tc = await getTranslations("profile.registrations.confirm");

  // Read-only heat display (PRD #26, slice #30). Published heats only, and only
  // while the race is still ahead. The keys live under `profile.registrations`
  // because the profile card renders the same two facts — one source of truth
  // rather than a second copy of "Heat" in three languages. The page's other,
  // pre-existing English literals are deliberately left alone (PRD #26).
  const tr = await getTranslations("profile.registrations");
  const heat =
    event?.status === "completed"
      ? undefined
      : (await publishedHeatsByRegistration([registrationId])).get(registrationId);

  // Race morning (PRD #26, slice #32): an admin turns this page into the
  // check-in surface, because the QR baked into sent tickets points here and
  // cannot be retargeted. Everyone else — the ticket's owner included — sees
  // exactly the page they saw before. The panel enforces nothing; its actions
  // do — and they require the check-in capability, so a view-only admin gets
  // the plain ticket rather than buttons that would 404.
  const canCheckIn = userCan(await getAdminUser(), "checkin");

  // The other half of race morning: a volunteer who scanned with the phone's own
  // camera app lands here in a browser with no admin session, sees the plain
  // ticket, and is stuck. This is their way back in — sign in, return to *this*
  // ticket, panel open. Locale-relative, because the sign-in form pushes
  // `redirectTo` through the next-intl router (see `requireAdmin`).
  //
  // It is shown to everyone with a valid signature, the ticket's owner included,
  // so it must stay page chrome: a footer link, no admin vocabulary beyond the
  // word "staff", and nothing about the runner it wasn't already showing.
  const staffSignInHref = `/auth/sign-in?redirectTo=${encodeURIComponent(
    `/tickets/${encodeURIComponent(registrationId)}?s=${encodeURIComponent(s)}#admin`,
  )}`;

  return (
    <div className="ace-landing iv tk-page">
      <InteriorHeader />
      <main className="iv-main">
        <div className="iv-wrap iv-wrap--narrow">
          <div className="tk-card">
            <div className="tk-card__head">
              <span className="tk-wordmark">
                ACE BATTLE <span className="tk-wordmark__run">RUN</span>
              </span>
              <span className="tk-card__event">{view.eventName}</span>
            </div>

            <div className="tk-card__body">
              <h1 className="tk-title">Race ticket</h1>
              <p className="tk-meta">
                {[view.eventDateLabel, view.eventTime, view.eventVenue].filter(Boolean).join(" · ")}
              </p>

              <div className="tk-grid">
                <Field label="Runner" value={view.fullName} />
                <Field label="Entry" value="Free" />
                <Field label="Email" value={view.email} />
                {view.club ? <Field label="Club" value={view.club} /> : null}
                <Field label="Bib" value={view.bib ? String(view.bib) : "Assigned at check-in"} />
                {heat ? (
                  <Field
                    label={tr("heat")}
                    value={tr("heatValue", {
                      number: heat.number,
                      time: formatHeatTime(heat.scheduledAt),
                    })}
                  />
                ) : null}
              </div>
            </div>

            <div className="tk-qr">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUri} alt="Ticket QR code" width={200} height={200} />
              <span>Scan at check-in</span>
            </div>

            <div className="tk-card__foot">
              <CheckInBadge checkedInAt={view.checkedInAt} />
              <span className="tk-code">#{view.registrationId.slice(0, 8).toUpperCase()}</span>
            </div>
          </div>

          {canCheckIn ? (
            <TicketAdminPanel
              registrationId={registrationId}
              sig={s}
              locale={locale}
              slug={loaded.registration.eventSlug}
              ok={ok}
              error={error}
              heat={heatFlash}
            />
          ) : null}

          <div id="confirm" className="tk-confirm iv-no-print">
            {notice ? (
              <p className={`tk-confirm__note${notice.ok ? " tk-confirm__note--ok" : ""}`} role="status">
                {tc(notice.key)}
              </p>
            ) : null}
            {canConfirm ? (
              <>
                <p className="tk-confirm__ask">{tc("ask")}</p>
                <ConfirmAttendanceForm
                  registrationId={registrationId}
                  locale={locale}
                  surface="ticket"
                  sig={s}
                  buttonClassName="btn btn-red"
                />
              </>
            ) : loaded.registration.confirmedAt ? (
              <p className="tk-confirm__note tk-confirm__note--ok">{tc("state")}</p>
            ) : null}
          </div>

          <div className="iv-actions iv-no-print" style={{ justifyContent: "center" }}>
            <DownloadTicketButton label="Download ticket" />
          </div>
          <p className="iv-note iv-no-print" style={{ textAlign: "center" }}>
            Keep this page private. The QR is your ticket.
          </p>
          {canCheckIn ? null : (
            <p className="tk-staff iv-no-print">
              <Link href={staffSignInHref}>Staff sign-in</Link>
            </p>
          )}
        </div>
      </main>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="tk-field">
      <div className="tk-field__label">{label}</div>
      <div className="tk-field__value">{value}</div>
    </div>
  );
}

function CheckInBadge({ checkedInAt }: { checkedInAt: Date | null }) {
  if (!checkedInAt) {
    return <span className="tk-pill">Not checked in</span>;
  }
  const formatted = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(checkedInAt);
  return <span className="tk-pill tk-pill--ok">Checked in · {formatted}</span>;
}
