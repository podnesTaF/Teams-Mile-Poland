import { eq } from "drizzle-orm";

import { users } from "@/db/schema";
import { getAppUrl } from "@/features/registration/data";
import { signUnsubscribe, verifyUnsubscribe } from "@/features/ticket/sign";
import { getDb } from "@/lib/db";
import { defaultLocale } from "@/lib/i18n/config";

import type { MailLocale } from "./copy";

/**
 * A self-contained unsubscribe token: the user id joined to its HMAC signature
 * by a `.`. Better Auth user ids are alphanumeric and signatures are base64url,
 * so neither contains a `.` — the last `.` cleanly separates them. Carried as a
 * single `?token=` param per the PRD contract.
 */
export function makeUnsubscribeToken(userId: string): string {
  return `${userId}.${signUnsubscribe(userId)}`;
}

function parseUnsubscribeToken(token: string): { userId: string; signature: string } | null {
  const idx = token.lastIndexOf(".");
  if (idx <= 0 || idx === token.length - 1) return null;
  return { userId: token.slice(0, idx), signature: token.slice(idx + 1) };
}

/** Locale-prefixed public unsubscribe URL for a recipient. */
export function makeUnsubscribeUrl(userId: string, locale: MailLocale): string {
  const prefix = locale === defaultLocale ? "" : `/${locale}`;
  return `${getAppUrl()}${prefix}/unsubscribe?token=${encodeURIComponent(makeUnsubscribeToken(userId))}`;
}

/**
 * Honor an unsubscribe link: verify the signed token and set `marketing_opt_out`.
 * Idempotent (a repeat click is a harmless re-set) and non-revealing — a valid
 * signature for a non-existent user still returns `ok`, so the page never leaks
 * whether an address is on file. Only a bad/tampered signature returns `invalid`.
 */
export async function applyUnsubscribe(token: string): Promise<"ok" | "invalid"> {
  const parsed = parseUnsubscribeToken(token);
  if (!parsed || !verifyUnsubscribe(parsed.userId, parsed.signature)) {
    return "invalid";
  }
  await getDb()
    .update(users)
    .set({ marketingOptOut: true })
    .where(eq(users.id, parsed.userId));
  return "ok";
}

/** Trilingual footer line for the broadcast email, localized by stored locale. */
const FOOTER_COPY: Record<MailLocale, { line: string; cta: string }> = {
  en: { line: "You're receiving this as a Teams Mile participant.", cta: "Unsubscribe" },
  pl: { line: "Otrzymujesz tę wiadomość jako uczestnik Teams Mile.", cta: "Wypisz się" },
  ua: { line: "Ви отримали цей лист як учасник Teams Mile.", cta: "Відписатися" },
};

export function unsubscribeFooter(
  userId: string,
  locale: MailLocale,
): { line: string; cta: string; url: string } {
  return { ...FOOTER_COPY[locale], url: makeUnsubscribeUrl(userId, locale) };
}
