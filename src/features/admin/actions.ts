"use server";

import { createHash, timingSafeEqual } from "node:crypto";

import { redirect } from "next/navigation";

import { clearAdminSession, setAdminSession } from "@/lib/auth/admin-session";

import { adminPath, safeLocale } from "./action-helpers";

function passwordMatches(input: string) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  // Compare fixed-length sha256 digests so the check is constant-time and
  // doesn't leak length through early-exit.
  const a = createHash("sha256").update(input).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function adminLogin(formData: FormData) {
  const locale = safeLocale(formData.get("locale"));
  const password = String(formData.get("password") ?? "");

  if (!passwordMatches(password)) {
    redirect(adminPath(locale, "/login?error=1"));
  }

  await setAdminSession();
  redirect(adminPath(locale));
}

export async function adminLogout(formData: FormData) {
  const locale = safeLocale(formData.get("locale"));
  await clearAdminSession();
  redirect(adminPath(locale, "/login"));
}
