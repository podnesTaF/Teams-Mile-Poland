import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import "@/app/landing.css";

import { InteriorHeader } from "@/components/landing/interior-header";
import { DownloadTicketButton } from "@/features/ticket/components/download-ticket-button";
import {
  generateTicketQrPng,
  loadTicketByRunnerId,
  makeTicketUrl,
  verifyTicket,
} from "@/features/ticket";

type PageProps = {
  params: Promise<{ locale: string; runnerId: string }>;
  searchParams: Promise<{ s?: string }>;
};

export default async function TicketPage({ params, searchParams }: PageProps) {
  const { locale, runnerId } = await params;
  const { s } = await searchParams;
  setRequestLocale(locale);

  if (!s || !verifyTicket(runnerId, s)) {
    notFound();
  }

  const loaded = await loadTicketByRunnerId(runnerId);
  if (!loaded) {
    notFound();
  }

  const { view, checkedInAt } = loaded;
  const paymentLine =
    view.paymentStatus === "free" ? "Free runner slot" : "50 PLN registration paid";

  // QR encodes the (re-signed) ticket URL so check-in staff scan straight
  // back to this ticket. Embedded as a data URI so it's part of the print.
  const qrBuffer = await generateTicketQrPng(makeTicketUrl(runnerId, { locale }));
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
                {view.eventDateLabel} · {view.eventVenue}
              </p>

              <div className="tk-grid">
                <Field label="Runner" value={view.fullName} />
                <Field label="Payment" value={paymentLine} />
                <Field label="Email" value={view.email} />
                <Field label="Phone" value={view.phone} />
                {view.teamName ? <Field label="Team" value={view.teamName} /> : null}
                {view.teamCode ? <Field label="Team code" value={view.teamCode} mono /> : null}
                {!view.teamName ? <Field label="Status" value="Pending team assignment" /> : null}
              </div>
            </div>

            <div className="tk-qr">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUri} alt="Ticket QR code" width={200} height={200} />
              <span>Scan at check-in</span>
            </div>

            <div className="tk-card__foot">
              <CheckInBadge checkedInAt={checkedInAt} />
              <span className="tk-code">#{view.runnerId.slice(0, 8).toUpperCase()}</span>
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

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="tk-field">
      <div className="tk-field__label">{label}</div>
      <div className={mono ? "tk-field__value tk-field__value--mono" : "tk-field__value"}>{value}</div>
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
