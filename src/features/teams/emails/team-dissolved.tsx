import { Text } from "@react-email/components";

import { Btn, C, EmailShell, Field, HeroBand, SectionPad } from "@/emails/components";

/**
 * "This team no longer exists" — sent to every remaining member when a team is
 * dissolved (#62), never to whoever pressed the button.
 *
 * Dissolve is a hard delete, so this email is the only record the runner will
 * have; it names the team explicitly rather than saying "your team". Copy
 * arrives translated (see {@link RemovedFromTeamEmail} for why).
 */
export type TeamDissolvedEmailProps = {
  preview: string;
  eyebrow: string;
  title: string;
  greeting: string;
  intro: string;
  teamLabel: string;
  teamName: string;
  outro: string;
  /** Optional "start your own team" link. */
  cta?: { label: string; href: string };
};

export function TeamDissolvedEmail({
  preview,
  eyebrow,
  title,
  greeting,
  intro,
  teamLabel,
  teamName,
  outro,
  cta,
}: TeamDissolvedEmailProps) {
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

        {cta ? (
          <Btn href={cta.href} variant="primary">
            {cta.label}
          </Btn>
        ) : null}

        <Text style={{ ...para, margin: "16px 0 0", color: C.muted }}>{outro}</Text>
      </SectionPad>
    </EmailShell>
  );
}

export default TeamDissolvedEmail;
