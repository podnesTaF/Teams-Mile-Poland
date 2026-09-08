import { TeamMailShell, TeamMailText, type TeamMailFacts, type TeamMailLabels } from "./shell";

/**
 * "Your team has been withdrawn" — sent to every entered member when the
 * manager (or the organiser, exercising the rules' right to refuse admission)
 * withdraws the entry (PRD #64, user story 25: "so that I do not turn up").
 *
 * Sent **before** the rows are deleted, because after the delete there is
 * nothing left to name: the entry, the registrations, the consent evidence and
 * the log rows all go in one transaction. This email is the member's only
 * remaining record that they were entered at all, so it carries the team facts
 * and the race it was for rather than a bare notice.
 *
 * No call to action beyond the team page: there is nothing for the member to do
 * about it, and the manager is the person who can enter them again.
 */
export type EntryWithdrawnEmailProps = {
  preview: string;
  eyebrow: string;
  title: string;
  /** "<event name> · <date>" — the race that is now off for them. */
  sub: string;
  greeting: string;
  intro: string;
  outro: string;
  team: TeamMailFacts;
  labels: TeamMailLabels;
  cta: { label: string; href: string };
};

export function EntryWithdrawnEmail({
  preview,
  eyebrow,
  title,
  sub,
  greeting,
  intro,
  outro,
  team,
  labels,
  cta,
}: EntryWithdrawnEmailProps) {
  return (
    <TeamMailShell
      preview={preview}
      eyebrow={eyebrow}
      title={title}
      sub={sub}
      team={team}
      labels={labels}
      cta={{ href: cta.href, label: cta.label }}
      note={outro}
    >
      <TeamMailText>{greeting}</TeamMailText>
      <TeamMailText>{intro}</TeamMailText>
    </TeamMailShell>
  );
}

export default EntryWithdrawnEmail;
