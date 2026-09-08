import { TeamMailShell, TeamMailText, type TeamMailFacts, type TeamMailLabels } from "./shell";

/**
 * "<runner> joined <team>" — sent to the manager the moment an invitation is
 * accepted (PRD #57, Emails → 4; user story 25 "so that I see the roster grow").
 *
 * Carries the roster count against the minimum, so the manager learns both that
 * someone joined and how far the team still is from **Complete** without opening
 * the page.
 */

export type TeamInvitationAcceptedCopy = {
  preview: string;
  eyebrow: string;
  title: string;
  /** "{name} accepted your invitation to {team}." */
  body: string;
  /** "The roster now has {count} of {min} runners." / the complete variant. */
  roster: string;
  cta: string;
  labels: TeamMailLabels;
};

export function TeamInvitationAcceptedEmail({
  copy,
  team,
  url,
}: {
  copy: TeamInvitationAcceptedCopy;
  team: TeamMailFacts;
  /** Absolute link to the team page. */
  url: string;
}) {
  return (
    <TeamMailShell
      preview={copy.preview}
      eyebrow={copy.eyebrow}
      title={copy.title}
      team={team}
      labels={copy.labels}
      cta={{ href: url, label: copy.cta }}
    >
      <TeamMailText>{copy.body}</TeamMailText>
      <TeamMailText>{copy.roster}</TeamMailText>
    </TeamMailShell>
  );
}

export default TeamInvitationAcceptedEmail;
