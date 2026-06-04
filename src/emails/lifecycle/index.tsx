import { Text } from "@react-email/components";

import { Btn, C, EmailShell, Field, HeroBand, SectionPad } from "@/emails/components";

import {
  contactValue,
  lifecycleContent,
  UI,
  type LifecycleAction,
  type LifecycleCtx,
  type LifecycleKind,
  type MailLocale,
} from "./copy";

export type LifecycleUrls = {
  calendar: string;
  ics: string;
  ticket: string;
  map: string;
  invite?: string;
};

const para = { margin: "0 0 12px", fontSize: "14px", lineHeight: "1.6", color: C.text } as const;

/**
 * One parameterized template for every scheduled lifecycle email
 * (−14d / −7d / −3d / −1d / morning / captain-incomplete). Copy + CTAs are
 * driven by `kind` + `locale` via ./copy, so all six share one layout.
 */
export function LifecycleEmail({
  kind,
  locale,
  ctx,
  urls,
}: {
  kind: LifecycleKind;
  locale: MailLocale;
  ctx: LifecycleCtx;
  urls: LifecycleUrls;
}) {
  const c = lifecycleContent(kind, locale, ctx);
  const ui = UI[locale];

  const actionHref: Record<LifecycleAction, string | undefined> = {
    calendar: urls.calendar,
    ics: urls.ics,
    ticket: urls.ticket,
    map: urls.map,
    invite: urls.invite,
  };
  const actionLabel: Record<LifecycleAction, string> = {
    calendar: ui.calendar,
    ics: ui.ics,
    ticket: ui.ticket,
    map: ui.map,
    invite: ui.invite,
  };
  const actions = c.actions.filter((a) => actionHref[a]);

  return (
    <EmailShell preview={c.preview}>
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
            <Field label={ui.dateLabel} value={ui.dateValue} />
            <Field label={ui.timeLabel} value={ui.timeValue} />
            <Field label={ui.venueLabel} value={ui.venueValue} />
            <Field label={ui.contactLabel} value={contactValue()} />
          </div>
        ) : null}

        {actions.map((a, i) => (
          <div key={a} style={{ marginTop: i === 0 ? 0 : 8 }}>
            <Btn href={actionHref[a]!} variant={i === 0 ? "primary" : "ghost"}>
              {actionLabel[a]}
            </Btn>
          </div>
        ))}

        {c.outro ? <Text style={{ ...para, margin: "16px 0 0", color: C.muted }}>{c.outro}</Text> : null}
      </SectionPad>
    </EmailShell>
  );
}

/**
 * Ad-hoc admin broadcast. `bodyHtml` is admin-authored (trusted) and rendered
 * inside the branded shell.
 */
export function BroadcastEmail({
  subject,
  bodyHtml,
  preview,
}: {
  subject: string;
  bodyHtml: string;
  preview?: string;
}) {
  return (
    <EmailShell preview={preview ?? subject}>
      <HeroBand eyebrow="ACE BATTLE RUN" title={subject} />
      <SectionPad>
        <div
          style={{ fontSize: "14px", lineHeight: "1.6", color: C.text }}
          dangerouslySetInnerHTML={{ __html: bodyHtml }}
        />
      </SectionPad>
    </EmailShell>
  );
}
