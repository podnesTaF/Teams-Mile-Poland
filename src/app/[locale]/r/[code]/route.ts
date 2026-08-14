import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  findReferrerByCode,
  REF_COOKIE,
  REF_COOKIE_MAX_AGE_SECONDS,
} from "@/features/referral/data";
import { appAbsoluteUrl } from "@/lib/app-url";
import { defaultLocale, locales } from "@/lib/i18n/config";

/**
 * Referral link landing: `/r/<code>` drops the code in a cookie and forwards to
 * the localized homepage. An unknown code still lands on the homepage, just
 * without the cookie — a stale shared link should never dead-end. Attribution
 * happens later, at account creation (see `applyReferralAttribution`).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ locale: string; code: string }> },
) {
  const { locale: rawLocale, code } = await params;
  const locale = (locales as readonly string[]).includes(rawLocale) ? rawLocale : defaultLocale;
  const home = NextResponse.redirect(
    appAbsoluteUrl(locale === defaultLocale ? "/" : `/${locale}`),
  );

  if (!process.env.DATABASE_URL) return home;

  const referrer = await findReferrerByCode(decodeURIComponent(code)).catch(() => null);
  if (referrer) {
    const store = await cookies();
    store.set(REF_COOKIE, code, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: REF_COOKIE_MAX_AGE_SECONDS,
    });
  }
  return home;
}
