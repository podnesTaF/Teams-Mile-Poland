import { notFound, redirect } from "next/navigation";

import { getUser, isAdmin, userCan, type SessionUser } from "@/lib/auth/user-session";
import type { AdminCapability } from "@/lib/auth/roles";
import { defaultLocale, locales } from "@/lib/i18n/config";

export function safeLocale(value: FormDataEntryValue | null) {
  const v = typeof value === "string" ? value : "";
  return (locales as readonly string[]).includes(v) ? v : defaultLocale;
}

export function adminPath(locale: string, suffix = "") {
  const prefix = locale === defaultLocale ? "" : `/${locale}`;
  return `${prefix}/admin${suffix}`;
}

/**
 * The single admin gate for every admin page and server action: the caller must
 * be signed in through the normal Better Auth login *and* hold an admin role.
 * There is no separate admin password or admin cookie any more.
 *
 * `capability` is what the call site does, not who may call it (levels live in
 * `src/lib/auth/roles.ts`): pages ask for the default `"view"` (any admin
 * level renders them), check-in actions ask for `"checkin"`, every other
 * mutation asks for `"edit"`.
 *
 * The failure modes are deliberately different:
 *  - signed out → send them to the shared sign-in page, which returns them here
 *    (`redirectTo` is locale-relative, the form pushes it through the next-intl
 *    router).
 *  - signed in as a plain user, or an admin below the required level →
 *    `notFound()`, so the admin panel is not discoverable by browsing. The UI
 *    hides what a level cannot do, so hitting this as an admin means a crafted
 *    request — a 404 is the right answer to that too. A redirect back to
 *    sign-in would be a login loop for someone who is already logged in.
 *
 * Returns the admin user so callers that need the actor (audit copy, "you"
 * checks in admin management) don't have to fetch the session twice.
 */
export async function requireAdmin(
  locale: string,
  capability: AdminCapability = "view",
): Promise<SessionUser> {
  const user = await getUser();
  if (!user) {
    redirect(
      `${locale === defaultLocale ? "" : `/${locale}`}/auth/sign-in?redirectTo=${encodeURIComponent("/admin")}`,
    );
  }
  if (!isAdmin(user) || !userCan(user, capability)) {
    notFound();
  }
  return user;
}
