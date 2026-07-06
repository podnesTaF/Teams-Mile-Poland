"use client";

import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { authClient } from "@/lib/auth/auth-client";

import { LogOutButton } from "./log-out-button";

/**
 * Header auth affordance: "Profile" + "Log out" when signed in, "Sign in"
 * otherwise. Renders nothing while the session is still loading to avoid a
 * flash.
 */
export function AuthNav() {
  const t = useTranslations("auth");
  const { data, isPending } = authClient.useSession();

  if (isPending) return null;

  if (!data) {
    return (
      <Link href="/auth/sign-in" className="iv-header__auth">
        {t("nav.signIn")}
      </Link>
    );
  }

  return (
    <>
      <Link href="/profile" className="iv-header__auth">
        {t("nav.profile")}
      </Link>
      <LogOutButton className="iv-header__auth" />
    </>
  );
}
