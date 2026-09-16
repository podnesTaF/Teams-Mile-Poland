import { TeamMailShell, TeamMailText, type TeamMailFacts, type TeamMailLabels } from "./shell";

/**
 * The manager's answer to a join request, sent to the runner (PRD #57,
 * Emails → 3). **One template, two variants** rather than two files: the
 * accepted and declined mails are the same envelope, the same team facts and
 * the same single button, differing only in which sentences and which
 * destination they carry — splitting them would duplicate the shell to change a
 * paragraph.
 *
 * Accepted points at the team (they are on it now); declined points at the
 * public recruiting list, because "no" is only useful to a runner who is told
 * where to knock next. `roster` is omitted on the declined variant: the state of
 * a roster the runner is not on is not their business.
 *
 * Copy arrives resolved in the runner's own locale (see `mail-requests.ts`).
 */

export type TeamJoinRequestDecidedCopy = {
  preview: string;
  eyebrow: string;
  title: string;
  greeting: string;
  /** "You are on the roster of {team}." / "{team} could not take you." */
  body: string;
  /** Accepted only: "The roster now has {count} runners." */
  roster?: string;
  outro: string;
  cta: string;
  labels: TeamMailLabels;
};

export function TeamJoinRequestDecidedEmail({
  copy,
  team,
  url,
  accepted,
}: {
  copy: TeamJoinRequestDecidedCopy;
  team: TeamMailFacts;
  /** The team page when accepted, the recruiting list when declined. */
  url: string;
  accepted: boolean;
}) {
  return (
    <TeamMailShell
      preview={copy.preview}
      eyebrow={copy.eyebrow}
      title={copy.title}
      team={team}
      labels={copy.labels}
      cta={{ href: url, label: copy.cta }}
      note={copy.outro}
    >
      <TeamMailText>{copy.greeting}</TeamMailText>
      <TeamMailText>{copy.body}</TeamMailText>
      {accepted && copy.roster ? <TeamMailText>{copy.roster}</TeamMailText> : null}
    </TeamMailShell>
  );
}

export default TeamJoinRequestDecidedEmail;
