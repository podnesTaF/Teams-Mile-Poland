import { Text } from "@react-email/components";

import { Btn, C, EmailShell, Field, HeroBand, SectionPad } from "@/emails/components";
import {
  confirmBlockCopy,
  eventMailContent,
  UI,
  type EventMailAction,
  type MailLocale,
} from "@/features/event-mailings/copy";
import type { EventScheduledKind } from "@/features/event-mailings/schedule";

export type EventMailUrls = {
  calendar: string;
  ticket: string;
  map: string;
  /** Ticket page anchored at its confirm CTA — see {@link EventLifecycleEmail}. */
  confirm: string;
};

export type EventWhenWhere = {
  date: string;
  time: string;
  venue: string;
  contact: string;
};

/**
 * One parameterized template for every individual-event lifecycle email. Copy
 * comes from ./copy by kind+locale; the when/where block is passed in from the
 * registry event (date/time/venue), so it's correct for each mile night.
 *
 * `showConfirm` renders the attendance ask (PRD #26). The caller passes it only
 * for reminder kinds and only while the registration is still `registered`, so
 * a runner who has already answered is never nagged again. The button links to
 * the signed ticket page rather than confirming on click: a GET that mutates
 * would be fired by the link-scanning in corporate mail gateways, silently
 * confirming people who never opened the email.
 */
export function EventLifecycleEmail({
  kind,
  locale,
  fullName,
  urls,
  whenWhere,
  footerMeta,
  showConfirm = false,
}: {
  kind: EventScheduledKind;
  locale: MailLocale;
  fullName: string;
  urls: EventMailUrls;
  whenWhere: EventWhenWhere;
  /** Event-specific footer line — see {@link eventFooterMeta}. */
  footerMeta?: string;
  showConfirm?: boolean;
}) {
  const c = eventMailContent(kind, locale, fullName);
  const ui = UI[locale];
  const para = { margin: "0 0 12px", fontSize: "14px", lineHeight: "1.6", color: C.text } as const;

  const actionHref: Record<EventMailAction, string> = {
    calendar: urls.calendar,
    ticket: urls.ticket,
    map: urls.map,
  };
  const actionLabel: Record<EventMailAction, string> = {
    calendar: ui.calendar,
    ticket: ui.ticket,
    map: ui.map,
  };

  return (
    <EmailShell preview={c.preview} footerMeta={footerMeta}>
      <HeroBand eyebrow={c.eyebrow} title={c.title} />
      <SectionPad>
        <Text style={{ ...para, color: C.white, fontWeight: 700 }}>{c.greeting}</Text>
        <Text style={para}>{c.intro}</Text>

        {c.bullets && c.bullets.length > 0 ? (
          <ul style={{ margin: "0 0 14px", paddingLeft: "20px", color: C.text }}>
            {c.bullets.map((b, i) => (
              <li key={i} style={{ fontSize: "14px", lineHeight: "1.7" }}>
                {b}
              </li>
            ))}
          </ul>
        ) : null}

        {showConfirm ? <ConfirmAsk locale={locale} href={urls.confirm} /> : null}

        {c.showWhenWhere ? (
          <div
            style={{
              border: `1px solid ${C.border}`,
              borderRadius: "8px",
              padding: "16px 16px 4px",
              margin: "4px 0 16px",
              backgroundColor: C.cardSoft,
            }}
          >
            <Text
              style={{
                margin: "0 0 12px",
                fontSize: "11px",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: C.muted,
                fontWeight: 700,
              }}
            >
              {ui.whenWhere}
            </Text>
            <Field label={ui.dateLabel} value={whenWhere.date} />
            <Field label={ui.timeLabel} value={whenWhere.time} />
            <Field label={ui.venueLabel} value={whenWhere.venue} />
            <Field label={ui.contactLabel} value={whenWhere.contact} />
          </div>
        ) : null}

        {c.actions.map((a, i) => (
          <div key={a} style={{ marginTop: i === 0 ? 0 : 8 }}>
            <Btn href={actionHref[a]} variant={i === 0 ? "primary" : "ghost"}>
              {actionLabel[a]}
            </Btn>
          </div>
        ))}

        {c.outro ? <Text style={{ ...para, margin: "16px 0 0", color: C.muted }}>{c.outro}</Text> : null}
      </SectionPad>
    </EmailShell>
  );
}

/** The conditional attendance ask — a callout, visually distinct from the body. */
function ConfirmAsk({ locale, href }: { locale: MailLocale; href: string }) {
  const copy = confirmBlockCopy(locale);
  return (
    <div
      style={{
        border: `1px solid ${C.border}`,
        borderRadius: "8px",
        padding: "16px",
        margin: "4px 0 16px",
        backgroundColor: C.cardSoft,
      }}
    >
      <Text
        style={{
          margin: "0 0 6px",
          fontSize: "15px",
          lineHeight: "1.4",
          color: C.white,
          fontWeight: 700,
        }}
      >
        {copy.title}
      </Text>
      <Text style={{ margin: "0 0 14px", fontSize: "14px", lineHeight: "1.6", color: C.text }}>
        {copy.body}
      </Text>
      <Btn href={href} variant="primary">
        {copy.cta}
      </Btn>
    </div>
  );
}

export default EventLifecycleEmail;
