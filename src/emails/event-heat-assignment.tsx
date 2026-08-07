import { Text } from "@react-email/components";

import { Btn, C, EmailShell, Field, HeroBand, Rule, SectionPad } from "@/emails/components";
import { heatAssignmentMailContent, type MailLocale } from "@/features/event-mailings/copy";

/**
 * The heat-assignment mailing (`heat_assignment` kind — PRD #26, slice #30),
 * dispatched by `publishHeats`.
 *
 * **One** template for both the first notice and a later change: `changed` only
 * swaps the hero copy and the intro, because the facts a runner needs (heat
 * number, approximate start, ticket link) are the same either way. A second
 * email kind would have duplicated all of that to vary two sentences.
 *
 * `startTime` arrives pre-formatted as Warsaw wall-clock — the template does no
 * timezone work of its own, so what the runner reads is what the marshal reads.
 */
export function EventHeatAssignmentEmail({
  locale,
  fullName,
  eventName,
  heatNumber,
  startTime,
  ticketUrl,
  changed,
  footerMeta,
}: {
  locale: MailLocale;
  fullName: string;
  eventName: string;
  heatNumber: number;
  /** Warsaw wall-clock, "10:20". */
  startTime: string;
  ticketUrl: string;
  changed: boolean;
  /** Event-specific footer line — see {@link eventFooterMeta}. */
  footerMeta?: string;
}) {
  const c = heatAssignmentMailContent(locale, fullName, { changed });
  const para = { margin: "0 0 12px", fontSize: "14px", lineHeight: "1.6", color: C.text } as const;

  return (
    <EmailShell preview={c.preview} footerMeta={footerMeta}>
      <HeroBand eyebrow={c.eyebrow} title={c.title} sub={eventName} />
      <SectionPad>
        <Text style={{ ...para, color: C.white, fontWeight: 700 }}>{c.greeting}</Text>
        <Text style={{ ...para, margin: 0 }}>{c.intro}</Text>
      </SectionPad>

      <Rule />

      <SectionPad soft>
        <Field label={c.heatLabel} value={String(heatNumber)} />
        {/* The tilde is deliberate and belongs to the value: a runner skimming on
            a phone should see "approximate" before they read the caveat below. */}
        <Field label={c.timeLabel} value={`~ ${startTime}`} />
        <Text style={{ ...para, margin: 0, fontSize: "13px", color: C.muted }}>{c.approxNote}</Text>
      </SectionPad>

      <SectionPad>
        <Btn href={ticketUrl} variant="primary">
          {c.cta}
        </Btn>
        <Text style={{ ...para, margin: "16px 0 0", color: C.muted }}>{c.outro}</Text>
      </SectionPad>
    </EmailShell>
  );
}

export default EventHeatAssignmentEmail;
