import { Text } from "@react-email/components";

import { Btn, C, EmailShell, HeroBand, SectionPad } from "./components";

/** Sent when a user requests a password reset. */
export function ResetPasswordEmail({ url, firstName }: { url: string; firstName?: string }) {
  const greeting = firstName ? `Hi ${firstName},` : "Hi,";
  return (
    <EmailShell preview="Reset your password — TEAMS MILE Warsaw">
      <HeroBand
        eyebrow="TEAMS MILE Warsaw"
        title="Reset your password"
        sub="This link expires in 1 hour."
      />
      <SectionPad>
        <Text style={{ margin: "0 0 14px", fontSize: "15px", lineHeight: "1.5", color: C.text }}>
          {greeting}
        </Text>
        <Text style={{ margin: "0 0 20px", fontSize: "15px", lineHeight: "1.5", color: C.text }}>
          We received a request to reset your password. Choose a new one:
        </Text>
        <Btn href={url}>Set a new password</Btn>
        <Text style={{ margin: "18px 0 0", fontSize: "12px", lineHeight: "1.5", color: C.muted }}>
          If you didn&apos;t request this, ignore this email — your password stays the same.
        </Text>
      </SectionPad>
    </EmailShell>
  );
}

export default ResetPasswordEmail;
