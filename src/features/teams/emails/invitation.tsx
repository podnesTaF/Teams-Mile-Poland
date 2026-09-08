import { TeamMailShell, TeamMailText, type TeamMailFacts, type TeamMailLabels } from "./shell";

/**
 * "You have been invited to join <team>" — the mail `inviteByEmail` sends to the
 * address the manager typed (PRD #57, Emails → 1).
 *
 * Two variants of one template, keyed on the invitation row's `on_behalf`:
 * a manager's own invitation names the manager, an organiser's invitation
 * (admin, #63) says the organiser sent it, so the runner is not confused by a
 * mail from a team they never contacted.
 */

export type TeamInvitationCopy = {
  preview: string;
  eyebrow: string;
  title: string;
  greeting: string;
  /** "{inviter} invited you to join {team}." */
  body: string;
  /** The `on_behalf` sentence — "The organiser invited you…". */
  bodyOnBehalf: string;
  intro: string;
  cta: string;
  /** "The link works until {date}." */
  expiry: string;
  ignore: string;
  labels: TeamMailLabels;
};

export function TeamInvitationEmail({
  copy,
  team,
  url,
  onBehalf,
}: {
  copy: TeamInvitationCopy;
  team: TeamMailFacts;
  /** Absolute `/teams/invite/<raw token>` link — the only place the raw token exists. */
  url: string;
  onBehalf: boolean;
}) {
  return (
    <TeamMailShell
      preview={copy.preview}
      eyebrow={copy.eyebrow}
      title={copy.title}
      team={team}
      labels={copy.labels}
      cta={{ href: url, label: copy.cta }}
      note={`${copy.expiry} ${copy.ignore}`}
    >
      <TeamMailText>{copy.greeting}</TeamMailText>
      <TeamMailText>{onBehalf ? copy.bodyOnBehalf : copy.body}</TeamMailText>
      <TeamMailText>{copy.intro}</TeamMailText>
    </TeamMailShell>
  );
}

export default TeamInvitationEmail;
