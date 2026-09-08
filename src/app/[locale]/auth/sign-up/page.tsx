import { setRequestLocale } from "next-intl/server";

import "@/app/landing.css";
import "@/app/series-flows.css";

import { AuthPageShell } from "@/features/auth/components/auth-shell";
import { SignUpForm } from "@/features/auth/components/sign-up-form";

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ redirectTo?: string; email?: string }>;
};

/**
 * `email` prefills the address field (PRD #57): a team invitation link opened
 * by a visitor without an account sends them here with the invited address
 * already filled in, so they do not retype it — and, because `redirectTo`
 * carries the invite token, they land back on the accept screen afterwards.
 * Without the parameter nothing changes.
 */
export default async function SignUpPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const { redirectTo, email } = await searchParams;
  setRequestLocale(locale);

  return (
    <AuthPageShell>
      <SignUpForm locale={locale} redirectTo={redirectTo || "/profile"} email={email} />
    </AuthPageShell>
  );
}
