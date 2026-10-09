import { Img, Section, Text } from "@react-email/components";

import type { EventTicketView, TeamRaceEmailCopy } from "@/features/event-registration/ticket";

import { Btn, C, EmailShell, Field, HeroBand, Rule, SectionPad } from "./components";

type Props = {
  view: EventTicketView;
  ticketUrl: string;
  qrCid: string;
  /** Localized set-password CTA — lets the runner set a password for later sign-in. */
  setPassword?: { line: string; cta: string; url: string };
  /**
   * The team variant (ADR 0016): a placement-team member's registration. The
   * ticket is the same; the subject, a heading and one paragraph about the
   * confirm-then-compose step are added, in the runner's language.
   */
  teamRace?: TeamRaceEmailCopy;
};

export function EventTicketEmail({ view, ticketUrl, qrCid, setPassword, teamRace }: Props) {
  return (
    <EmailShell
      preview={teamRace?.subject ?? eventTicketSubject(view)}
      footerMeta={[view.eventVenue, view.eventDateLabel].filter(Boolean).join(" · ")}
    >
      <HeroBand
        eyebrow={view.eventName}
        title="Your race ticket"
        sub={[view.eventDateLabel, view.eventTime, view.eventVenue].filter(Boolean).join(" · ")}
      />

      <SectionPad>
        <Field label="Runner" value={view.fullName} />
        {view.club ? <Field label="Club" value={view.club} /> : null}
        <Field label="Entry" value={`${view.entryLabel} — confirmed.`} />
        {view.teamLabel ? <Field label="Race" value={`Team race — ${view.teamLabel}`} /> : null}
      </SectionPad>

      {teamRace ? (
        <>
          <Rule />
          <SectionPad>
            <Text style={{ margin: "0 0 8px", fontSize: "18px", fontWeight: 700, color: C.white }}>
              {teamRace.heading}
            </Text>
            <Text style={{ margin: 0, fontSize: "14px", lineHeight: "22px", color: C.text }}>
              {teamRace.line}
            </Text>
          </SectionPad>
        </>
      ) : null}

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

      {setPassword ? (
        <>
          <Rule />
          <SectionPad soft>
            <Text style={{ margin: "0 0 14px", fontSize: "14px", color: C.muted, textAlign: "center" }}>
              {setPassword.line}
            </Text>
            <Btn href={setPassword.url}>{setPassword.cta}</Btn>
          </SectionPad>
        </>
      ) : null}
    </EmailShell>
  );
}

export function eventTicketSubject(view: Pick<EventTicketView, "eventName">) {
  return `You're registered — ${view.eventName}`;
}

export default EventTicketEmail;
