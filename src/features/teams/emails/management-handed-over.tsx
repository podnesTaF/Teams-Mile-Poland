import { Text } from "@react-email/components";

import { Btn, C, EmailShell, Field, HeroBand, SectionPad } from "@/emails/components";

/**
 * "You are now this team's manager" — sent to the runner management was handed
 * to (#62). The outgoing manager is not mailed: they pressed the button.
 *
 * The duties list is what actually changed for the recipient, so it is spelled
 * out rather than left to "you now have duties". Copy arrives translated (see
 * {@link RemovedFromTeamEmail} for why).
 */
export type ManagementHandedOverEmailProps = {
  preview: string;
  eyebrow: string;
  title: string;
  greeting: string;
  intro: string;
  teamLabel: string;
  teamName: string;
  dutiesTitle: string;
  duties: string[];
  ctaLabel: string;
  ctaHref: string;
};

export function ManagementHandedOverEmail({
  preview,
  eyebrow,
  title,
  greeting,
  intro,
  teamLabel,
  teamName,
  dutiesTitle,
  duties,
  ctaLabel,
  ctaHref,
}: ManagementHandedOverEmailProps) {
  const para = { margin: "0 0 12px", fontSize: "14px", lineHeight: "1.6", color: C.text } as const;

  return (
    <EmailShell preview={preview}>
      <HeroBand eyebrow={eyebrow} title={title} />
      <SectionPad>
        <Text style={{ ...para, color: C.white, fontWeight: 700 }}>{greeting}</Text>
        <Text style={para}>{intro}</Text>

        <div
          style={{
            border: `1px solid ${C.border}`,
            borderRadius: "8px",
            padding: "16px 16px 4px",
            margin: "4px 0 16px",
            backgroundColor: C.cardSoft,
          }}
        >
          <Field label={teamLabel} value={teamName} />
        </div>

        <Text
          style={{
            margin: "0 0 8px",
            fontSize: "11px",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: C.muted,
            fontWeight: 700,
          }}
        >
          {dutiesTitle}
        </Text>
        <ul style={{ margin: "0 0 16px", paddingLeft: "20px", color: C.text }}>
          {duties.map((duty) => (
            <li key={duty} style={{ fontSize: "14px", lineHeight: "1.7" }}>
              {duty}
            </li>
          ))}
        </ul>

        <Btn href={ctaHref} variant="primary">
          {ctaLabel}
        </Btn>
      </SectionPad>
    </EmailShell>
  );
}

export default ManagementHandedOverEmail;
