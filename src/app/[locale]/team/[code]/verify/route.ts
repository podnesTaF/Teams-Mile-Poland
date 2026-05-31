import { NextResponse } from "next/server";

import { getTeamByCode, isCaptainRunner, normalizeTeamCode } from "@/features/team/data";
import { consumeMagicLink } from "@/features/team/tokens";
import { setTeamSession } from "@/lib/auth/team-session";
import { defaultLocale, locales } from "@/lib/i18n/config";

import { eq } from "drizzle-orm";

import { runners } from "@/db/schema";
import { getDb } from "@/lib/db";

function teamPathFor(locale: string, code: string) {
  const prefix = locale === defaultLocale ? "" : `/${locale}`;
  return `${prefix}/team/${encodeURIComponent(code)}`;
}

function safeLocale(value: string) {
  return (locales as readonly string[]).includes(value) ? value : defaultLocale;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ locale: string; code: string }> },
) {
  const { locale: rawLocale, code: rawCode } = await params;
  const locale = safeLocale(rawLocale);
  const code = normalizeTeamCode(decodeURIComponent(rawCode));
  const baseUrl = new URL(request.url);

  const team = await getTeamByCode(code);
  if (!team) {
    return NextResponse.redirect(
      new URL(`${teamPathFor(locale, code)}/access?error=invalid`, baseUrl),
    );
  }

  const rawToken = new URL(request.url).searchParams.get("token");
  if (!rawToken) {
    return NextResponse.redirect(
      new URL(`${teamPathFor(locale, code)}/access?error=invalid`, baseUrl),
    );
  }

  const result = await consumeMagicLink({ rawToken, expectedTeamId: team.id });

  if (!result.ok) {
    const errorParam =
      result.reason === "expired"
        ? "expired"
        : result.reason === "used"
          ? "used"
          : "invalid";
    return NextResponse.redirect(
      new URL(`${teamPathFor(locale, code)}/access?error=${errorParam}`, baseUrl),
    );
  }

  const [runner] = await getDb()
    .select()
    .from(runners)
    .where(eq(runners.id, result.runnerId))
    .limit(1);

  if (!runner) {
    return NextResponse.redirect(
      new URL(`${teamPathFor(locale, code)}/access?error=invalid`, baseUrl),
    );
  }

  await setTeamSession({
    teamId: team.id,
    teamCode: team.code,
    email: result.email,
    runnerId: runner.id,
    role: isCaptainRunner(runner) ? "captain" : "member",
  });

  return NextResponse.redirect(new URL(teamPathFor(locale, code), baseUrl));
}
