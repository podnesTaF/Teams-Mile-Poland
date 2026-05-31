"use server";

import { createHash, timingSafeEqual } from "node:crypto";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import {
  clearAdminSession,
  getAdminSession,
  setAdminSession,
} from "@/lib/auth/admin-session";
import { defaultLocale, locales } from "@/lib/i18n/config";

import {
  deleteInquiryById,
  deleteRunnerCascade,
  deleteTeamCascade,
  setInquiryStatus,
} from "./data";

function safeLocale(value: FormDataEntryValue | null) {
  const v = typeof value === "string" ? value : "";
  return (locales as readonly string[]).includes(v) ? v : defaultLocale;
}

function adminPath(locale: string, suffix = "") {
  const prefix = locale === defaultLocale ? "" : `/${locale}`;
  return `${prefix}/admin${suffix}`;
}

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

async function requireAdmin(locale: string) {
  const session = await getAdminSession();
  if (!session) {
    redirect(adminPath(locale, "/login"));
  }
}

export async function markInquiryHandled(formData: FormData) {
  const locale = safeLocale(formData.get("locale"));
  await requireAdmin(locale);
  const id = String(formData.get("id") ?? "");
  const next = String(formData.get("next") ?? "handled") === "new" ? "new" : "handled";
  if (id) await setInquiryStatus(id, next);
  revalidatePath(adminPath(locale));
}

export async function deleteInquiry(formData: FormData) {
  const locale = safeLocale(formData.get("locale"));
  await requireAdmin(locale);
  const id = String(formData.get("id") ?? "");
  if (id) await deleteInquiryById(id);
  revalidatePath(adminPath(locale));
}

export async function removeTeam(formData: FormData) {
  const locale = safeLocale(formData.get("locale"));
  await requireAdmin(locale);
  const id = String(formData.get("id") ?? "");
  if (id) await deleteTeamCascade(id);
  revalidatePath(adminPath(locale));
}

export async function removeRunner(formData: FormData) {
  const locale = safeLocale(formData.get("locale"));
  await requireAdmin(locale);
  const id = String(formData.get("id") ?? "");
  if (id) await deleteRunnerCascade(id);
  revalidatePath(adminPath(locale));
}
