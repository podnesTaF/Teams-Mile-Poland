import { setRequestLocale } from "next-intl/server";

import "@/app/landing.css";
import "@/app/series-flows.css";

import { AuthPageShell } from "@/features/auth/components/auth-shell";
import { SignInForm } from "@/features/auth/components/sign-in-form";

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ redirectTo?: string; error?: string; error_description?: string }>;
};

/**
 * Better Auth codes are snake_case identifiers (`account_not_linked`,
 * `unable_to_link_account`, `state_not_found`, …). Anything else in `?error=`
 * came from someone hand-crafting the URL, so it is logged but never rendered —
 * the banner would otherwise be a free text field an attacker controls on a
 * page that already asks for a password.
 */
function safeErrorCode(raw: string | undefined): string | null {
  return raw && /^[a-z0-9_]{1,64}$/i.test(raw) ? raw : null;
}

export default async function SignInPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  // `error` is appended by Better Auth when an OAuth callback fails — the
  // GoogleButton points `errorCallbackURL` back here. Every such bounce used to
  // land as one generic banner and nothing else, which made a linking refusal
  // (`account_not_linked`) indistinguishable from a misconfigured client id or
  // an expired state. Log the code where deploy logs will keep it, then hand it
  // to the form so a runner can quote it.
  const { redirectTo, error, error_description: description } = await searchParams;
  setRequestLocale(locale);

  if (error) {
    console.error(
      `[auth] OAuth callback bounced to sign-in: error=${JSON.stringify(error)}` +
        (description ? ` description=${JSON.stringify(description)}` : ""),
    );
  }

  return (
    <AuthPageShell>
      <SignInForm
        redirectTo={redirectTo || "/profile"}
        oauthError={Boolean(error)}
        oauthErrorCode={safeErrorCode(error)}
      />
    </AuthPageShell>
  );
}
