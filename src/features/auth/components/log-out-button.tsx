"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth/auth-client";

/**
 * Sign-out control. Renders a plain button styled by `className` (a `.btn`
 * variant on the profile page, or a nav-link class in the headers — the latter
 * get a button reset in CSS). Signs out via Better Auth, then returns home.
 */
export function LogOutButton({ className }: { className?: string }) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onClick() {
    if (pending) return;
    setPending(true);
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <button type="button" className={className} onClick={onClick} disabled={pending}>
      {pending ? t("nav.loggingOut") : t("nav.logOut")}
    </button>
  );
}
