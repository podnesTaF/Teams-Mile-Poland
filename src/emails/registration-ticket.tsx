import { Img, Section, Text } from "@react-email/components";

import type { TicketView } from "@/features/ticket/types";

import { Btn, C, EmailShell, Field, HeroBand, Rule, SectionPad } from "./components";

type Props = {
  ticket: TicketView;
  magicUrl: string;
  ticketUrl: string;
  inviteUrl?: string;
  qrCid: string;
};

export function RegistrationTicketEmail({ ticket, magicUrl, ticketUrl, inviteUrl, qrCid }: Props) {
  const paymentLine =
    ticket.paymentStatus === "free"
      ? "Free runner slot — entry confirmed."
      : "50 PLN registration payment confirmed.";

  return (
    <EmailShell preview={subjectForFlow(ticket)}>
      <HeroBand
        eyebrow={ticket.eventName}
        title="Your race ticket"
        sub={`${ticket.eventDateLabel} · ${ticket.eventVenue}`}
      />

      <SectionPad>
        <Field label="Runner" value={ticket.fullName} />
        <Field
          label="Contact"
          value={
            <>
              {ticket.email}
              <br />
              {ticket.phone}
            </>
          }
        />
        {ticket.teamName || ticket.teamCode ? (
          <Field
            label="Team"
            value={
              <>
                {ticket.teamName ?? "—"}
                {ticket.teamCode ? (
                  <>
                    <br />
                    <span style={{ fontFamily: "monospace", letterSpacing: "0.06em", color: C.muted }}>
                      {ticket.teamCode}
                    </span>
                  </>
                ) : null}
              </>
            }
          />
        ) : (
          <Field label="Status" value="Pending team assignment" />
        )}
        <Field label="Payment" value={paymentLine} />
      </SectionPad>

      <Rule />

      {/* QR on a white tile so it always scans */}
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
          Show this code at the venue. Save or download your ticket below.
        </Text>
      </SectionPad>

      <Rule />

      <SectionPad>
        <Btn href={ticketUrl}>View &amp; download ticket</Btn>
        <div style={{ height: "10px" }} />
        <Btn href={magicUrl} variant="ghost">
          Open team dashboard
        </Btn>
      </SectionPad>

      {inviteUrl ? (
        <>
          <Rule />
          <SectionPad soft>
            <Text
              style={{
                margin: "0 0 6px",
                fontSize: "10px",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: C.red,
                fontWeight: 700,
              }}
            >
              Invite your team
            </Text>
            <Text style={{ margin: "0 0 14px", fontSize: "14px", color: C.text }}>
              Send this link to your runners so they can join your team.
            </Text>
            <Btn href={inviteUrl}>Copy the invite link</Btn>
            <Text
              style={{
                margin: "12px 0 0",
                fontFamily: "monospace",
                fontSize: "12px",
                color: C.muted,
                wordBreak: "break-all",
              }}
            >
              {inviteUrl}
            </Text>
          </SectionPad>
        </>
      ) : null}
    </EmailShell>
  );
}

export function subjectForFlow(ticket: Pick<TicketView, "flow">) {
  if (ticket.flow === "start") return "Your ACE BATTLE team is live";
  if (ticket.flow === "free") return "You are registered for ACE BATTLE RUN";
  return "Your ACE BATTLE RUN registration is confirmed";
}

export default RegistrationTicketEmail;
