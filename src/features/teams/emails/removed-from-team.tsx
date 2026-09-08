import { TeamMailShell, TeamMailText, type TeamMailFacts, type TeamMailLabels } from "./shell";

/**
 * "You are no longer on this team" — sent to the member a manager removed
 * (#62). Copy arrives already translated: the send helper resolves
 * `teams.emails.removed` for the recipient's own locale, because a React Email
 * template is rendered synchronously and cannot await a translator.
 *
 * Built on {@link TeamMailShell} like every other team mail, so the team facts
 * block (name, category, region) and the footer are identical across the seven
 * templates — the runner is reading about a team, and which team it was is the
 * first thing they need to see.
 */
export type RemovedFromTeamEmailProps = {
  preview: string;
  eyebrow: string;
  title: string;
  greeting: string;
  intro: string;
  outro: string;
  team: TeamMailFacts;
  labels: TeamMailLabels;
  /** Optional "find another team" link; omitted when there is nowhere to send them. */
  cta?: { label: string; href: string };
};

export function RemovedFromTeamEmail({
  preview,
  eyebrow,
  title,
  greeting,
  intro,
  outro,
  team,
  labels,
  cta,
}: RemovedFromTeamEmailProps) {
  return (
    <TeamMailShell
      preview={preview}
      eyebrow={eyebrow}
      title={title}
      team={team}
      labels={labels}
      cta={cta ? { href: cta.href, label: cta.label } : undefined}
      note={outro}
    >
      <TeamMailText>{greeting}</TeamMailText>
      <TeamMailText>{intro}</TeamMailText>
    </TeamMailShell>
  );
}

export default RemovedFromTeamEmail;
