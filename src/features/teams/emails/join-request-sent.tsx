import { TeamMailShell, TeamMailText, type TeamMailFacts, type TeamMailLabels } from "./shell";

/**
 * The runner's receipt for a join request: "your request is with the captain".
 * Sent alongside the manager's "received" mail, so the runner has something in
 * their inbox the moment they knock rather than only once (and if) the manager
 * answers. The button goes to the profile's request list, where the status lives
 * and the request can be withdrawn.
 *
 * Copy arrives resolved in the runner's own locale (see `mail-requests.ts`).
 */

export type TeamJoinRequestSentCopy = {
  preview: string;
  eyebrow: string;
  title: string;
  greeting: string;
  /** "Your request to join {team} is with the captain." */
  body: string;
  outro: string;
  cta: string;
  labels: TeamMailLabels;
};

export function TeamJoinRequestSentEmail({
  copy,
  team,
  url,
}: {
  copy: TeamJoinRequestSentCopy;
  team: TeamMailFacts;
  /** Absolute link to the profile's `#teams` section. */
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
      note={copy.outro}
    >
      <TeamMailText>{copy.greeting}</TeamMailText>
      <TeamMailText>{copy.body}</TeamMailText>
    </TeamMailShell>
  );
}

export default TeamJoinRequestSentEmail;
