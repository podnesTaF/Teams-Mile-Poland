import { setRequestLocale } from "next-intl/server";

import "@/app/landing.css";
import "@/app/series-flows.css";

import { AuthPageShell } from "@/features/auth/components/auth-shell";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string; error?: string }>;
};

export default async function ResetPasswordPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const { token, error } = await searchParams;
  setRequestLocale(locale);

  return (
    <AuthPageShell>
      <ResetPasswordForm token={token} invalid={Boolean(error)} />
    </AuthPageShell>
  );
}
