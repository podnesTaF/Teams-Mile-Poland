import { redirect } from "next/navigation";

import { getAdminSession } from "@/lib/auth/admin-session";
import { defaultLocale, locales } from "@/lib/i18n/config";

export function safeLocale(value: FormDataEntryValue | null) {
  const v = typeof value === "string" ? value : "";
  return (locales as readonly string[]).includes(v) ? v : defaultLocale;
}

export function adminPath(locale: string, suffix = "") {
  const prefix = locale === defaultLocale ? "" : `/${locale}`;
  return `${prefix}/admin${suffix}`;
}

export async function requireAdmin(locale: string) {
  const session = await getAdminSession();
  if (!session) {
    redirect(adminPath(locale, "/login"));
  }
}
