"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { users } from "@/db/schema";
import { getDb } from "@/lib/db";
import { auth } from "@/lib/auth/better-auth";
import { defaultLocale } from "@/lib/i18n/config";

import { adminPath, requireAdmin, safeLocale } from "./action-helpers";

/** Redirect back to a users path with a status message. */
function back(locale: string, suffix: string, msg: string): never {
  revalidatePath(adminPath(locale, "/users"));
  redirect(adminPath(locale, `/users${suffix}?msg=${encodeURIComponent(msg)}`));
}

/** Where the verification link lands after verify + auto-sign-in. */
function eventsCallbackUrl(locale: string): string {
  const prefix = locale === defaultLocale ? "" : `/${locale}`;
  return `${prefix}/events`;
}

/**
 * Delete a user and everything that cascades from it (registrations, legacy
 * participation, sessions, accounts — all FK `on delete cascade`). Returns to
 * the users list. Confirm dialog upstream.
 */
export async function deleteUser(formData: FormData) {
  const locale = safeLocale(formData.get("locale"));
  await requireAdmin(locale);
  const id = String(formData.get("id") ?? "");
  if (!id) back(locale, "", "No user specified.");

  await getDb().delete(users).where(eq(users.id, id));
  back(locale, "", "User deleted.");
}

/**
 * Re-send the Better Auth verification email to an unverified account so an
 * imported or stuck person can claim it; the link lands on the events section.
 * No-op for already-verified accounts. `redirectTo` is a users-path suffix
 * (e.g. "" for the list, "/<id>" for the detail page).
 */
export async function resendUserVerification(formData: FormData) {
  const locale = safeLocale(formData.get("locale"));
  await requireAdmin(locale);
  const id = String(formData.get("id") ?? "");
  const redirectTo = String(formData.get("redirectTo") ?? "");
  if (!id) back(locale, redirectTo, "No user specified.");

  const db = getDb();
  const [user] = await db
    .select({ email: users.email, emailVerified: users.emailVerified })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  if (!user) back(locale, redirectTo, "User not found.");
  if (user.emailVerified) back(locale, redirectTo, "Account is already verified.");

  try {
    await auth.api.sendVerificationEmail({
      body: { email: user.email, callbackURL: eventsCallbackUrl(locale) },
    });
  } catch {
    back(locale, redirectTo, "Could not send the verification email. Try again.");
  }
  back(locale, redirectTo, "Verification email sent.");
}
