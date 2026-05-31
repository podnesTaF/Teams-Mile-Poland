"use client";

import { useTranslations } from "next-intl";

import { signOut } from "@/features/team/actions";

export function SignOutButton({ code, locale }: { code: string; locale: string }) {
  const t = useTranslations("team.dashboard");
  return (
    <form action={signOut}>
      <input type="hidden" name="code" value={code} />
      <input type="hidden" name="locale" value={locale} />
      <button type="submit" className="btn btn-stroke btn-sm">
        {t("signOut")}
      </button>
    </form>
  );
}
