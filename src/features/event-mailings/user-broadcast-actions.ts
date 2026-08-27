"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { render } from "@react-email/render";

import { BroadcastEmail } from "@/emails/lifecycle";
import { adminPath, requireAdmin, safeLocale } from "@/features/admin/action-helpers";

import { asMailLocale } from "./copy";
import { previewUnsubscribeFooter } from "./unsubscribe";
import {
  pickBroadcastVariant,
  resendUserBroadcast,
  sendUserBroadcast,
  type BroadcastVariants,
} from "./user-broadcast";
import { parseUserSegment } from "./user-segments";

function back(locale: string, msg: string): never {
  const path = adminPath(locale, "/mailings");
  revalidatePath(path);
  redirect(`${path}?msg=${encodeURIComponent(msg)}`);
}

/**
 * Read one optional locale variant off the form. Complete pair → variant;
 * both empty → absent; half-filled → a labeled error, because delivery only
 * understands complete pairs and silently guessing the missing half would
 * mail someone a subject or body the admin never reviewed.
 */
function readVariant(
  formData: FormData,
  subjectField: string,
  bodyField: string,
  label: string,
): { variant?: { subject: string; bodyHtml: string }; error?: string } {
  const subject = String(formData.get(subjectField) ?? "").trim();
  const bodyHtml = String(formData.get(bodyField) ?? "").trim();
  if (!subject && !bodyHtml) return {};
  if (!subject || !bodyHtml) {
    return {
      error: `The ${label} version needs both a subject and a message — fill both or leave both empty.`,
    };
  }
  return { variant: { subject, bodyHtml } };
}

export async function sendUserBroadcastAction(formData: FormData) {
  const locale = safeLocale(formData.get("locale"));
  await requireAdmin(locale, "edit");

  const subject = String(formData.get("subject") ?? "").trim();
  const bodyHtml = String(formData.get("body") ?? "").trim();
  // Awaited, not just typed: `parseUserSegment` reads the event list from the DB
  // now. Left un-awaited, `segment` is a truthy Promise and the `!segment` gate
  // below — the tamper guard against a hand-posted segment value — never fires.
  const segment = await parseUserSegment(String(formData.get("segment") ?? ""));

  if (!subject || !bodyHtml) {
    back(locale, "Subject and message are required.");
  }
  if (!segment) {
    back(locale, "Unknown audience segment.");
  }

  const pl = readVariant(formData, "subject_pl", "body_pl", "Polish");
  if (pl.error) back(locale, pl.error);
  const ua = readVariant(formData, "subject_ua", "body_ua", "Ukrainian");
  if (ua.error) back(locale, ua.error);

  const r = await sendUserBroadcast(subject, bodyHtml, segment, {
    pl: pl.variant,
    ua: ua.variant,
  });
  back(
    locale,
    `User broadcast: ${r.sent} sent, ${r.skipped} skipped, ${r.failed} failed (of ${r.total}).`,
  );
}

export async function resendUserBroadcastAction(formData: FormData) {
  const locale = safeLocale(formData.get("locale"));
  await requireAdmin(locale, "edit");

  const broadcastId = String(formData.get("broadcastId") ?? "").trim();
  if (!broadcastId) {
    back(locale, "Missing broadcast.");
  }

  const r = await resendUserBroadcast(broadcastId);
  if ("refused" in r) {
    back(
      locale,
      r.refused === "notfound"
        ? "Broadcast not found."
        : "Nothing was sent — this broadcast was written for an event that can no longer be identified, so its audience cannot be rebuilt. Send a new broadcast to a segment that still exists.",
    );
  }
  back(
    locale,
    `Re-send: ${r.sent} sent, ${r.skipped} skipped, ${r.failed} failed (of ${r.total}).`,
  );
}

export type BroadcastPreviewInput = {
  /** Admin UI locale, for the auth gate only. */
  locale: string;
  /** Which recipient language to preview the email as. */
  mailLocale: string;
  subject: string;
  bodyHtml: string;
  subjectPl?: string;
  bodyHtmlPl?: string;
  subjectUa?: string;
  bodyHtmlUa?: string;
  /** User broadcasts carry the opt-out footer; the legacy composer doesn't. */
  withUnsubscribe: boolean;
};

export type BroadcastPreviewResult =
  | { html: string; subject: string; usedFallback: boolean }
  | { error: string };

/**
 * Render the exact broadcast email a recipient with the given locale would
 * receive — same template, same variant pick as delivery — as an HTML document
 * for the compose preview modal. Renders only, sends nothing, logs nothing.
 */
export async function previewBroadcastEmailAction(
  input: BroadcastPreviewInput,
): Promise<BroadcastPreviewResult> {
  const locale = safeLocale(input.locale);
  await requireAdmin(locale, "edit");

  const base = {
    subject: String(input.subject ?? "").trim(),
    bodyHtml: String(input.bodyHtml ?? "").trim(),
  };
  const half = (s?: string, b?: string) => {
    const subject = String(s ?? "").trim();
    const bodyHtml = String(b ?? "").trim();
    return subject && bodyHtml ? { subject, bodyHtml } : undefined;
  };
  const variants: BroadcastVariants = {
    pl: half(input.subjectPl, input.bodyHtmlPl),
    ua: half(input.subjectUa, input.bodyHtmlUa),
  };

  const mailLocale = asMailLocale(String(input.mailLocale ?? ""));
  const content = pickBroadcastVariant(base, variants, mailLocale);
  if (!content.subject || !content.bodyHtml) {
    return { error: "Write a subject and a message first, then preview." };
  }

  const html = await render(
    BroadcastEmail({
      subject: content.subject,
      bodyHtml: content.bodyHtml,
      unsubscribe: input.withUnsubscribe ? previewUnsubscribeFooter(mailLocale) : undefined,
    }),
  );
  const usedFallback =
    (mailLocale === "pl" && !variants.pl) || (mailLocale === "ua" && !variants.ua);
  return { html, subject: content.subject, usedFallback };
}
