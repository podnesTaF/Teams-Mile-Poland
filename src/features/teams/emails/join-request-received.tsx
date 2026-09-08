import { TeamMailShell, TeamMailText, type TeamMailFacts, type TeamMailLabels } from "./shell";

/**
 * "<runner> asked to join <team>" — sent to the manager the moment a join
 * request is filed (PRD #57, Emails → 2).
 *
 * The mirror of `invitation-accepted.tsx`: that one reports a roster that has
 * already grown, this one reports a decision waiting to be made, so the button
 * goes to the team's manage view rather than to the card. It carries the roster
 * count against the minimum for the same reason — the manager should be able to
 * judge "do we still need runners?" without opening the page.
 *
 * Copy arrives resolved from `mail-requests.ts` in the *manager's* locale; a
 * template that called `getTranslations` itself would mail the requester's
 * language instead.
 */

export type TeamJoinRequestReceivedCopy = {
  preview: string;
  eyebrow: string;
  title: string;
  /** "{name} would like to run for {team}." */
  body: string;
  /** "The roster has {count} of {min} runners." / the complete variant. */
  roster: string;
  /** "Accept or decline it on the team page." */
  intro: string;
  cta: string;
  labels: TeamMailLabels;
};

export function TeamJoinRequestReceivedEmail({
  copy,
  team,
  url,
}: {
  copy: TeamJoinRequestReceivedCopy;
  team: TeamMailFacts;
  /** Absolute link to the team page's manage view. */
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
      <TeamMailText>{copy.intro}</TeamMailText>
    </TeamMailShell>
  );
}

export default TeamJoinRequestReceivedEmail;
