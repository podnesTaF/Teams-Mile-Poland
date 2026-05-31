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

export function EmailShell({
  preview,
  children,
}: {
  preview: string;
  children: React.ReactNode;
}) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ margin: 0, backgroundColor: C.bg, padding: "28px 12px", fontFamily: fontStack }}>
        <Container style={{ maxWidth: "600px", margin: "0 auto" }}>
          <Section style={{ padding: "0 2px 16px" }}>
            <BrandWordmark />
          </Section>

          <Section
            style={{
              backgroundColor: C.card,
              border: `1px solid ${C.border}`,
              borderRadius: "12px",
              overflow: "hidden",
            }}
          >
            {children}
          </Section>

          <Section style={{ padding: "18px 4px 0" }}>
            <Text style={{ margin: 0, fontSize: "11px", lineHeight: "1.6", color: C.muted }}>
              ACE BATTLE RUN · Stadion Podskarbińska, Warsaw · 27 June 2026
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
    <Section style={{ padding: "22px 28px", backgroundColor: soft ? C.cardSoft : "transparent" }}>
      {children}
    </Section>
  );
}

export function Rule() {
  return <Hr style={{ borderColor: C.border, margin: 0 }} />;
}
