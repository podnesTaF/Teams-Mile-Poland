import { setRequestLocale } from "next-intl/server";

import "@/app/landing.css";
import "@/app/series-flows.css";

import { AuthPageShell } from "@/features/auth/components/auth-shell";
import { VerifyEmailView } from "@/features/auth/components/verify-email-view";

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ email?: string; redirectTo?: string }>;
};

export default async function VerifyEmailPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const { email, redirectTo } = await searchParams;
  setRequestLocale(locale);

  return (
    <AuthPageShell>
      <VerifyEmailView email={email} redirectTo={redirectTo || "/profile"} />
    </AuthPageShell>
  );
}
