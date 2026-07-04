import { setRequestLocale } from "next-intl/server";

import "@/app/series-flows.css";

import { AuthModalShell } from "@/features/auth/components/auth-shell";
import { VerifyEmailView } from "@/features/auth/components/verify-email-view";

export default async function InterceptedVerify({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ email?: string }>;
}) {
  const { locale } = await params;
  const { email } = await searchParams;
  setRequestLocale(locale);
  return (
    <AuthModalShell>
      <VerifyEmailView email={email} />
    </AuthModalShell>
  );
}
