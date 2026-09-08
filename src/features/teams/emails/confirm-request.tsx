import { TeamMailShell, TeamMailText, type TeamMailFacts, type TeamMailLabels } from "./shell";

/**
 * "Confirm your participation" — the one email a regular team member gets, and
 * the one action they have to take (PRD #64, user stories 15 and 16; slice #67).
 *
 * The same template serves all three occasions, because the runner is being
 * asked for exactly the same thing each time and only the opening sentence
 * differs (PRD #64, Emails → `team_confirm_request`, "opening line varies"):
 *
 *  - `entry`    — the manager has just entered the team;
 *  - `added`    — they joined after the entry and were added to it;
 *  - `reminder` — the manager pressed Remind.
 *
 * One template rather than three keeps the *link* identical across them, which
 * is what actually matters: it is a signed, passwordless link to the
 * confirmation screen (`/events/<slug>/confirm/<registrationId>?s=…`), the same
 * mechanism as the ticket, so nobody has to find a password on their phone.
 *
 * Copy arrives already translated — the send helper reads
 * `teams.emails.confirmRequest` in the *recipient's* own locale, because a
 * React Email component is rendered synchronously and cannot await a
 * translator.
 */
export type ConfirmRequestEmailProps = {
  preview: string;
  eyebrow: string;
  title: string;
  /** "<event name> · <date>" — the race this confirmation is for. */
  sub: string;
  greeting: string;
  /** The occasion-specific opening line, already picked by the send helper. */
  intro: string;
  /** What confirming involves: read, tick, one button. */
  body: string;
  /** Why it matters: an unconfirmed member cannot be checked in. */
  outro: string;
  team: TeamMailFacts;
  labels: TeamMailLabels;
  cta: { label: string; href: string };
  /** Muted line under the button — "the link is personal, do not forward". */
  note: string;
};

export function ConfirmRequestEmail({
  preview,
  eyebrow,
  title,
  sub,
  greeting,
  intro,
  body,
  outro,
  team,
  labels,
  cta,
  note,
}: ConfirmRequestEmailProps) {
  return (
    <TeamMailShell
      preview={preview}
      eyebrow={eyebrow}
      title={title}
      sub={sub}
      team={team}
      labels={labels}
      cta={{ href: cta.href, label: cta.label }}
      note={note}
    >
      <TeamMailText>{greeting}</TeamMailText>
      <TeamMailText>{intro}</TeamMailText>
      <TeamMailText>{body}</TeamMailText>
      <TeamMailText>{outro}</TeamMailText>
    </TeamMailShell>
  );
}

export default ConfirmRequestEmail;
