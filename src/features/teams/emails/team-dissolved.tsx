import { TeamMailShell, TeamMailText, type TeamMailFacts, type TeamMailLabels } from "./shell";

/**
 * "This team no longer exists" — sent to every remaining member when a team is
 * dissolved (#62), never to whoever pressed the button.
 *
 * Dissolve is a hard delete, so this email is the only record the runner will
 * have; it names the team explicitly rather than saying "your team", and the
 * facts block is filled from the row captured *before* the delete. Copy arrives
 * translated (see {@link RemovedFromTeamEmail} for why).
 */
export type TeamDissolvedEmailProps = {
  preview: string;
  eyebrow: string;
  title: string;
  greeting: string;
  intro: string;
  outro: string;
  team: TeamMailFacts;
  labels: TeamMailLabels;
  /** Optional "start your own team" link. */
  cta?: { label: string; href: string };
};

export function TeamDissolvedEmail({
  preview,
  eyebrow,
  title,
  greeting,
  intro,
  outro,
  team,
  labels,
  cta,
}: TeamDissolvedEmailProps) {
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

export default TeamDissolvedEmail;
