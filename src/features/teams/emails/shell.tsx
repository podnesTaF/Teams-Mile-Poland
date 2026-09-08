import { Text } from "@react-email/components";

import { Btn, C, EmailShell, Field, HeroBand, Rule, SectionPad } from "@/emails/components";

/**
 * The shared shell every team-formation email is built from (#60, reused by the
 * join-request mails in #61 and the roster mails in #62).
 *
 * It is deliberately **copy-free**: every string arrives resolved from the
 * caller, because the catalogs (`teams.emails.*`) are read per *recipient*
 * locale in the send helper, not per request locale. A template that called
 * `getTranslations` itself would silently mail the sender's language.
 *
 * Structure: the site's dark {@link EmailShell} (so the footer meta is the
 * standard one — team mail is not event-bound and must never carry an event
 * date), a red hero band, the team facts as labelled fields, then the body slot,
 * an optional call-to-action button and a muted note.
 */

/** The team facts every team mail repeats, already translated for the reader. */
export type TeamMailFacts = {
  name: string;
  /** The *label* ("Mixed"), never the raw `TeamCategory` key. */
  category: string;
  region: string;
};

/** Field labels for {@link TeamMailFacts}, in the recipient's language. */
export type TeamMailLabels = {
  team: string;
  category: string;
  region: string;
};

export function TeamMailShell({
  preview,
  eyebrow,
  title,
  sub,
  team,
  labels,
  cta,
  note,
  children,
}: {
  preview: string;
  eyebrow: string;
  title: string;
  sub?: string;
  team: TeamMailFacts;
  labels: TeamMailLabels;
  /** The one button. Omitted for mails with nowhere to go (a dissolved team). */
  cta?: { href: string; label: string };
  /** Small muted line under the button — expiry, "you can ignore this", … */
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <EmailShell preview={preview}>
      <HeroBand eyebrow={eyebrow} title={title} sub={sub} />

      <SectionPad soft>
        <Field label={labels.team} value={team.name} />
        <Field label={labels.category} value={team.category} />
        <Field label={labels.region} value={team.region} />
      </SectionPad>

      <Rule />

      <SectionPad>
        {children}
        {cta ? <Btn href={cta.href}>{cta.label}</Btn> : null}
        {note ? (
          <Text style={{ margin: "18px 0 0", fontSize: "12px", lineHeight: "1.5", color: C.muted }}>
            {note}
          </Text>
        ) : null}
      </SectionPad>
    </EmailShell>
  );
}

/** A body paragraph in the shell's body slot — the one text style team mails use. */
export function TeamMailText({ children }: { children: React.ReactNode }) {
  return (
    <Text style={{ margin: "0 0 14px", fontSize: "15px", lineHeight: "1.5", color: C.text }}>
      {children}
    </Text>
  );
}
