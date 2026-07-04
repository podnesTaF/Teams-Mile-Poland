import { setRequestLocale } from "next-intl/server";

import "@/app/series-flows.css";

import { AuthModalShell } from "@/features/auth/components/auth-shell";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";

export default async function InterceptedReset({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { locale } = await params;
  const { token, error } = await searchParams;
  setRequestLocale(locale);
  return (
    <AuthModalShell>
      <ResetPasswordForm token={token} invalid={Boolean(error)} />
    </AuthModalShell>
  );
}
