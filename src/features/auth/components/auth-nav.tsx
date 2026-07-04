"use client";

import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { authClient } from "@/lib/auth/auth-client";

/**
 * Header auth affordance: "Profile" when signed in, "Sign in" otherwise.
 * Renders nothing while the session is still loading to avoid a flash.
 */
export function AuthNav() {
  const t = useTranslations("auth");
  const { data, isPending } = authClient.useSession();

  if (isPending) return null;

  return (
    <Link href={data ? "/profile" : "/auth/sign-in"} className="iv-header__auth">
      {data ? t("nav.profile") : t("nav.signIn")}
    </Link>
  );
}
