"use client";

import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { authClient } from "@/lib/auth/auth-client";

import { LogOutButton } from "./log-out-button";

/**
 * Header auth affordance: "Profile" + "Log out" when signed in, "Sign in"
 * otherwise. Renders nothing while the session is still loading to avoid a
 * flash.
 *
 * Admins additionally get an "Admin panel" link. This is presentation only —
 * `role` rides on the session as a Better Auth additionalField, but the panel
 * itself is gated server-side by `requireAdmin`, so hiding or forging the link
 * grants nothing either way.
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
      {data.user.role === "admin" ? (
        <Link href="/admin" className="iv-header__auth">
          {t("nav.adminPanel")}
        </Link>
      ) : null}
      <Link href="/profile" className="iv-header__auth">
        {t("nav.profile")}
      </Link>
      <LogOutButton className="iv-header__auth" />
    </>
  );
}
