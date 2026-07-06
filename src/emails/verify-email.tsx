import { Text } from "@react-email/components";

import { Btn, C, EmailShell, HeroBand, SectionPad } from "./components";

/** Sent on sign-up so the user can confirm their email and finish registering. */
export function VerifyEmail({ url, firstName }: { url: string; firstName?: string }) {
  const greeting = firstName ? `Hi ${firstName},` : "Hi,";
  return (
    <EmailShell preview="Confirm your email — TEAMS MILE Warsaw">
      <HeroBand
        eyebrow="TEAMS MILE Warsaw"
        title="Confirm your email"
        sub="One tap and your account is ready."
      />
      <SectionPad>
        <Text style={{ margin: "0 0 14px", fontSize: "15px", lineHeight: "1.5", color: C.text }}>
          {greeting}
        </Text>
        <Text style={{ margin: "0 0 20px", fontSize: "15px", lineHeight: "1.5", color: C.text }}>
          Confirm this email address to activate your account and register for the mile series.
        </Text>
        <Btn href={url}>Verify email</Btn>
        <Text style={{ margin: "18px 0 0", fontSize: "12px", lineHeight: "1.5", color: C.muted }}>
          If you didn&apos;t create this account, you can ignore this message.
        </Text>
      </SectionPad>
    </EmailShell>
  );
}

export default VerifyEmail;
