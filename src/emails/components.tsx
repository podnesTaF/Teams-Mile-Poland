import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

import type { EventSummary } from "@/lib/events/types";

/**
 * Footer meta line for event-bound emails: "venue, city · date". Every email
 * about a specific event should pass this to {@link EmailShell} so the footer
 * names that event's date, not a hardcoded one.
 */
export function eventFooterMeta(
  event: Pick<EventSummary, "venue" | "city" | "shortDate">,
): string {
  return `${event.venue}, ${event.city} · ${event.shortDate}`;
}

/** Shared ACE BATTLE email palette — dark, branded, "looks like the site". */
export const C = {
  bg: "#15160f",
  ink: "#191a18",
  card: "#212220",
  cardSoft: "#1b1c1a",
  border: "#34352f",
  red: "#e51f32",
  redDark: "#bf1326",
  white: "#ffffff",
  text: "#ededed",
  muted: "#9b9b95",
  green: "#30b755",
} as const;

const fontStack = "'Helvetica Neue', Helvetica, Arial, sans-serif";

/**
 * Responsive rules for the shell. Everything is still styled inline (Outlook,
 * older clients), so phones only get these `!important` overrides — Gmail,
 * Apple Mail and Outlook mobile all honour head `<style>` media queries.
 * The 600px breakpoint equals the container width, so nothing changes on
 * desktop. Below it, the card goes edge to edge and every block's side
 * padding drops to 16px: on a 360px phone that turns ~250px of usable text
 * width into ~328px.
 *
 * `.ab-html` scopes admin-authored broadcast HTML: pasted designs tend to be
 * fixed-width tables with oversized images, both of which are forced fluid.
 * `.ab-prose` adds readable defaults for the plain-message case only, where
 * a bare `<h2>` or `<a>` would otherwise fall back to browser black on our
 * dark card.
 */
const RESPONSIVE_CSS = `
.ab-prose h1, .ab-prose h2, .ab-prose h3 { margin: 18px 0 8px; line-height: 1.25; color: ${C.white}; }
.ab-prose h1 { font-size: 22px; } .ab-prose h2 { font-size: 18px; } .ab-prose h3 { font-size: 16px; }
.ab-prose p { margin: 0 0 12px; }
.ab-prose ul, .ab-prose ol { margin: 0 0 12px; padding-left: 20px; }
.ab-prose a { color: #ff5a6b; }
.ab-html img { max-width: 100%; height: auto; }
@media only screen and (max-width: 600px) {
  .ab-body { padding: 0 !important; }
  .ab-brand { padding: 16px 16px 12px !important; }
  .ab-card { border-radius: 0 !important; border-left: 0 !important; border-right: 0 !important; }
  .ab-hero { padding: 22px 16px !important; }
  .ab-hero-title { font-size: 24px !important; line-height: 1.1 !important; }
  .ab-pad { padding: 20px 16px !important; }
  .ab-footer { padding: 16px 16px 24px !important; }
  .ab-html table { width: 100% !important; min-width: 0 !important; }
  .ab-html td, .ab-html th { box-sizing: border-box !important; }
}
`;

export function EmailShell({
  preview,
  footerMeta,
  children,
}: {
  preview: string;
  /** Event-specific footer line ("venue · date") — see {@link eventFooterMeta}.
   * Omitted (auth and other non-event emails) it falls back to the venue alone,
   * so no email ever carries another event's date. */
  footerMeta?: string;
  children: React.ReactNode;
}) {
  return (
    <Html>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>{RESPONSIVE_CSS}</style>
      </Head>
      <Preview>{preview}</Preview>
      <Body
        className="ab-body"
        style={{ margin: 0, backgroundColor: C.bg, padding: "28px 12px", fontFamily: fontStack }}
      >
        <Container style={{ maxWidth: "600px", margin: "0 auto" }}>
          <Section className="ab-brand" style={{ padding: "0 2px 16px" }}>
            <BrandWordmark />
          </Section>

          <Section
            className="ab-card"
            style={{
              backgroundColor: C.card,
              border: `1px solid ${C.border}`,
              borderRadius: "12px",
              overflow: "hidden",
            }}
          >
            {children}
          </Section>

          <Section className="ab-footer" style={{ padding: "18px 4px 0" }}>
            <Text style={{ margin: 0, fontSize: "11px", lineHeight: "1.6", color: C.muted }}>
              ACE BATTLE RUN · {footerMeta ?? "Stadion Podskarbińska, Warsaw"}
            </Text>
            <Text style={{ margin: "2px 0 0", fontSize: "11px", color: C.muted }}>
              © 2026 ACE BATTLE POLAND · Licensed event under ACE BATTLE ASSOCIATION
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export function BrandWordmark() {
  return (
    <Text
      style={{
        margin: 0,
        fontFamily: fontStack,
        fontWeight: 800,
        fontStyle: "italic",
        fontSize: "20px",
        letterSpacing: "0.04em",
        color: C.white,
        textTransform: "uppercase",
      }}
    >
      ACE BATTLE <span style={{ color: C.red }}>RUN</span>
    </Text>
  );
}

/** Red hero band at the top of the card. */
export function HeroBand({
  eyebrow,
  title,
  sub,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
}) {
  return (
    <Section
      className="ab-hero"
      style={{
        background: `linear-gradient(135deg, ${C.red} 0%, ${C.redDark} 100%)`,
        backgroundColor: C.red,
        padding: "26px 28px",
      }}
    >
      <Text
        style={{
          margin: "0 0 8px",
          fontSize: "11px",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.82)",
          fontWeight: 700,
        }}
      >
        {eyebrow}
      </Text>
      <Text
        className="ab-hero-title"
        style={{
          margin: 0,
          fontSize: "30px",
          lineHeight: "1.05",
          fontWeight: 800,
          fontStyle: "italic",
          textTransform: "uppercase",
          color: C.white,
        }}
      >
        {title}
      </Text>
      {sub ? (
        <Text style={{ margin: "10px 0 0", fontSize: "13px", color: "rgba(255,255,255,0.9)" }}>
          {sub}
        </Text>
      ) : null}
    </Section>
  );
}

export function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <Text
        style={{
          margin: "0 0 3px",
          fontSize: "10px",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: C.muted,
        }}
      >
        {label}
      </Text>
      <Text style={{ margin: "0 0 16px", fontSize: "15px", lineHeight: "1.45", color: C.text }}>
        {value}
      </Text>
    </>
  );
}

export function Btn({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "ghost";
}) {
  const primary = variant === "primary";
  return (
    <Button
      href={href}
      style={{
        display: "block",
        width: "100%",
        boxSizing: "border-box",
        textAlign: "center",
        padding: "13px 18px",
        fontSize: "13px",
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        textDecoration: "none",
        borderRadius: "6px",
        color: primary ? C.white : C.text,
        backgroundColor: primary ? C.red : "transparent",
        border: primary ? `1px solid ${C.red}` : `1px solid ${C.border}`,
      }}
    >
      {children}
    </Button>
  );
}

export function SectionPad({ children, soft }: { children: React.ReactNode; soft?: boolean }) {
  return (
    <Section
      className="ab-pad"
      style={{ padding: "22px 28px", backgroundColor: soft ? C.cardSoft : "transparent" }}
    >
      {children}
    </Section>
  );
}

export function Rule() {
  return <Hr style={{ borderColor: C.border, margin: 0 }} />;
}
