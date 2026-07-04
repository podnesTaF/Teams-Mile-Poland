import { setRequestLocale } from "next-intl/server";

import "@/app/series-flows.css";

import { AuthModalShell } from "@/features/auth/components/auth-shell";
import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form";

export default async function InterceptedForgot({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <AuthModalShell>
      <ForgotPasswordForm />
    </AuthModalShell>
  );
}
