import { setRequestLocale } from "next-intl/server";

import "@/app/series-flows.css";

import { AuthModalShell } from "@/features/auth/components/auth-shell";
import { SignUpForm } from "@/features/auth/components/sign-up-form";

export default async function InterceptedSignUp({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <AuthModalShell>
      <SignUpForm locale={locale} />
    </AuthModalShell>
  );
}
