import { setRequestLocale } from "next-intl/server";

import "@/app/series-flows.css";

import { AuthModalShell } from "@/features/auth/components/auth-shell";
import { SignInForm } from "@/features/auth/components/sign-in-form";

export default async function InterceptedSignIn({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ redirectTo?: string }>;
}) {
  const { locale } = await params;
  const { redirectTo } = await searchParams;
  setRequestLocale(locale);
  return (
    <AuthModalShell>
      <SignInForm redirectTo={redirectTo || "/profile"} />
    </AuthModalShell>
  );
}
