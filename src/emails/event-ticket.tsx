import { Img, Section, Text } from "@react-email/components";

import type { EventTicketView } from "@/features/event-registration/ticket";

import { Btn, C, EmailShell, Field, HeroBand, Rule, SectionPad } from "./components";

type Props = {
  view: EventTicketView;
  ticketUrl: string;
  qrCid: string;
};

export function EventTicketEmail({ view, ticketUrl, qrCid }: Props) {
  return (
    <EmailShell preview={eventTicketSubject(view)}>
      <HeroBand
        eyebrow={view.eventName}
        title="Your race ticket"
        sub={[view.eventDateLabel, view.eventTime, view.eventVenue].filter(Boolean).join(" · ")}
      />

      <SectionPad>
        <Field label="Runner" value={view.fullName} />
        {view.club ? <Field label="Club" value={view.club} /> : null}
        <Field label="Entry" value="Free — confirmed." />
      </SectionPad>

      <Rule />

      <SectionPad soft>
        <Text
          style={{
            margin: "0 0 14px",
            fontSize: "10px",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: C.muted,
            textAlign: "center",
          }}
        >
          Scan at check-in
        </Text>
        <Section
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "10px",
            padding: "16px",
            width: "200px",
            margin: "0 auto",
          }}
        >
          <Img
            src={`cid:${qrCid}`}
            alt="Ticket QR code"
            width="200"
            height="200"
            style={{ display: "block", margin: "0 auto" }}
          />
        </Section>
        <Text style={{ margin: "14px 0 0", fontSize: "12px", color: C.muted, textAlign: "center" }}>
          Show this code at the venue. Bib is assigned at check-in.
        </Text>
      </SectionPad>

      <Rule />

      <SectionPad>
        <Btn href={ticketUrl}>View &amp; download ticket</Btn>
      </SectionPad>
    </EmailShell>
  );
}

export function eventTicketSubject(view: Pick<EventTicketView, "eventName">) {
  return `You're registered — ${view.eventName}`;
}

export default EventTicketEmail;
