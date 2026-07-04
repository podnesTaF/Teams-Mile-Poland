import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import "@/app/landing.css";

import { InteriorHeader } from "@/components/landing/interior-header";
import { loadEventRegistration } from "@/features/event-registration/data";
import { buildEventTicketView, makeEventTicketUrl } from "@/features/event-registration/ticket";
import { generateTicketQrPng } from "@/features/ticket/qr";
import { verifyEventTicket } from "@/features/ticket/sign";
import { DownloadTicketButton } from "@/features/ticket/components/download-ticket-button";
import { getEventBySlug } from "@/lib/events/registry";

type PageProps = {
  params: Promise<{ locale: string; registrationId: string }>;
  searchParams: Promise<{ s?: string }>;
};

export default async function EventTicketPage({ params, searchParams }: PageProps) {
  const { locale, registrationId } = await params;
  const { s } = await searchParams;
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

          <div className="iv-actions iv-no-print" style={{ justifyContent: "center" }}>
            <DownloadTicketButton label="Download ticket" />
          </div>
          <p className="iv-note iv-no-print" style={{ textAlign: "center" }}>
            Keep this page private. The QR is your ticket.
          </p>
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
