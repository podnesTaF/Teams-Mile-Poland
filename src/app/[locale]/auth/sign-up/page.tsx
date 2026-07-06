import { setRequestLocale } from "next-intl/server";

import "@/app/landing.css";
import "@/app/series-flows.css";

import { AuthPageShell } from "@/features/auth/components/auth-shell";
import { SignUpForm } from "@/features/auth/components/sign-up-form";

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ redirectTo?: string }>;
};

export default async function SignUpPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const { redirectTo } = await searchParams;
  setRequestLocale(locale);

  return (
    <AuthPageShell>
      <SignUpForm locale={locale} redirectTo={redirectTo || "/profile"} />
    </AuthPageShell>
  );
}
