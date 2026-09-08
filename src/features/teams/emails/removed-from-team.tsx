import { Text } from "@react-email/components";

import { Btn, C, EmailShell, Field, HeroBand, SectionPad } from "@/emails/components";

/**
 * "You are no longer on this team" — sent to the member a manager removed
 * (#62). Copy arrives already translated: the send helper resolves
 * `teams.emails.removed` for the recipient's own locale, because a React Email
 * template is rendered synchronously and cannot await a translator.
 *
 * Built directly on the shared `@/emails/components` shell rather than on the
 * team-mail shell from #60, so the two slices could land in parallel; folding
 * this onto that shell is a swap of the three wrapper elements.
 */
export type RemovedFromTeamEmailProps = {
  preview: string;
  eyebrow: string;
  title: string;
  greeting: string;
  intro: string;
  teamLabel: string;
  teamName: string;
  outro: string;
  /** Optional "find another team" link; omitted when there is nowhere to send them. */
  cta?: { label: string; href: string };
};

export function RemovedFromTeamEmail({
  preview,
  eyebrow,
  title,
  greeting,
  intro,
  teamLabel,
  teamName,
  outro,
  cta,
}: RemovedFromTeamEmailProps) {
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

export default RemovedFromTeamEmail;
