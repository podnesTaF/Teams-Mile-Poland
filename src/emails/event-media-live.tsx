import { Text } from "@react-email/components";

import { Btn, C, EmailShell, HeroBand, SectionPad } from "@/emails/components";
import { mediaLiveMailContent, type MailLocale } from "@/features/event-mailings/copy";

/**
 * The manual "your photos are live" mailing (PRD #14, slice #18). One template,
 * copy by locale from ./copy; the single CTA opens the event's gallery page.
 * Sent by the admin action, not the scheduled chain, so there is no when/where
 * block — just the announcement and the gallery link.
 */
export function EventMediaLiveEmail({
  locale,
  fullName,
  eventName,
  galleryUrl,
  footerMeta,
}: {
  locale: MailLocale;
  fullName: string;
  eventName: string;
  galleryUrl: string;
  /** Event-specific footer line — see {@link eventFooterMeta}. */
  footerMeta?: string;
}) {
  const c = mediaLiveMailContent(locale, fullName);
  const para = { margin: "0 0 12px", fontSize: "14px", lineHeight: "1.6", color: C.text } as const;

  return (
    <EmailShell preview={c.preview} footerMeta={footerMeta}>
      <HeroBand eyebrow={c.eyebrow} title={c.title} sub={eventName} />
      <SectionPad>
        <Text style={{ ...para, color: C.white, fontWeight: 700 }}>{c.greeting}</Text>
        <Text style={para}>{c.intro}</Text>

        <div style={{ marginTop: 4 }}>
          <Btn href={galleryUrl} variant="primary">
            {c.cta}
          </Btn>
        </div>

        <Text style={{ ...para, margin: "16px 0 0", color: C.muted }}>{c.outro}</Text>
      </SectionPad>
    </EmailShell>
  );
}

export default EventMediaLiveEmail;
