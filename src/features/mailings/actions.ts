"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { getAdminSession } from "@/lib/auth/admin-session";
import { defaultLocale, locales } from "@/lib/i18n/config";
import { broadcastSegmentEnum } from "@/db/schema";

import { runDueMailings, sendKind } from "./dispatch";
import { sendBroadcast } from "./broadcast";
import { SCHEDULED_KINDS } from "./schedule";
import type { LifecycleKind } from "@/emails/lifecycle/copy";
import type { Segment } from "./audience";

const LIFECYCLE_KINDS: LifecycleKind[] = [...SCHEDULED_KINDS, "captain_incomplete"];
const SEGMENTS = broadcastSegmentEnum.enumValues;

function safeLocale(value: FormDataEntryValue | null) {
  const v = typeof value === "string" ? value : "";
  return (locales as readonly string[]).includes(v) ? v : defaultLocale;
}

function mailingsPath(locale: string, query = "") {
  const prefix = locale === defaultLocale ? "" : `/${locale}`;
  return `${prefix}/admin/mailings${query}`;
}

async function requireAdmin(locale: string) {
  if (!(await getAdminSession())) {
    redirect(`${locale === defaultLocale ? "" : `/${locale}`}/admin/login`);
  }
}

function back(locale: string, msg: string) {
  revalidatePath(mailingsPath(locale));
  redirect(mailingsPath(locale, `?msg=${encodeURIComponent(msg)}`));
}

export async function runDueMailingsAction(formData: FormData) {
  const locale = safeLocale(formData.get("locale"));
  await requireAdmin(locale);
  const summaries = await runDueMailings(new Date());
  const msg = summaries.length
    ? summaries.map((s) => `${s.kind}: ${s.sent} sent, ${s.skipped} skipped, ${s.failed} failed`).join(" · ")
    : "Nothing due right now.";
  back(locale, msg);
}

export async function sendKindNowAction(formData: FormData) {
  const locale = safeLocale(formData.get("locale"));
  await requireAdmin(locale);
  const kind = String(formData.get("kind") ?? "");
  if (!LIFECYCLE_KINDS.includes(kind as LifecycleKind)) {
    back(locale, "Unknown email kind.");
  }
  const s = await sendKind(kind as LifecycleKind);
  back(locale, `${s.kind}: ${s.sent} sent, ${s.skipped} skipped, ${s.failed} failed (of ${s.eligible}).`);
}

export async function sendBroadcastAction(formData: FormData) {
  const locale = safeLocale(formData.get("locale"));
  await requireAdmin(locale);

  const subject = String(formData.get("subject") ?? "").trim();
  const bodyHtml = String(formData.get("body") ?? "").trim();
  const segmentRaw = String(formData.get("segment") ?? "all");
  const teamId = String(formData.get("teamId") ?? "").trim() || null;
  const segment: Segment = (SEGMENTS as readonly string[]).includes(segmentRaw)
    ? (segmentRaw as Segment)
    : "all";

  if (!subject || !bodyHtml) {
    back(locale, "Subject and message are required.");
  }

  const result = await sendBroadcast({ subject, bodyHtml, segment, teamId });
  back(locale, `Broadcast: ${result.sent} sent, ${result.failed} failed (of ${result.total}).`);
}
