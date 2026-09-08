import { Text } from "@react-email/components";

import { C } from "@/emails/components";

import { TeamMailShell, TeamMailText, type TeamMailFacts, type TeamMailLabels } from "./shell";

/**
 * "You are now this team's manager" — sent to the runner management was handed
 * to (#62). The outgoing manager is not mailed: they pressed the button.
 *
 * The duties list is what actually changed for the recipient, so it is spelled
 * out rather than left to "you now have duties"; it is the one team mail whose
 * body is not plain paragraphs, and it sits in {@link TeamMailShell}'s body slot
 * like every other. Copy arrives translated (see {@link RemovedFromTeamEmail}
 * for why).
 */
export type ManagementHandedOverEmailProps = {
  preview: string;
  eyebrow: string;
  title: string;
  greeting: string;
  intro: string;
  dutiesTitle: string;
  duties: string[];
  team: TeamMailFacts;
  labels: TeamMailLabels;
  ctaLabel: string;
  ctaHref: string;
};

export function ManagementHandedOverEmail({
  preview,
  eyebrow,
  title,
  greeting,
  intro,
  dutiesTitle,
  duties,
  team,
  labels,
  ctaLabel,
  ctaHref,
}: ManagementHandedOverEmailProps) {
  return (
    <TeamMailShell
      preview={preview}
      eyebrow={eyebrow}
      title={title}
      team={team}
      labels={labels}
      cta={{ href: ctaHref, label: ctaLabel }}
    >
      <TeamMailText>{greeting}</TeamMailText>
      <TeamMailText>{intro}</TeamMailText>

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
    </TeamMailShell>
  );
}

export default ManagementHandedOverEmail;
