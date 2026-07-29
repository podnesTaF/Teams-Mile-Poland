import { NextResponse } from "next/server";

import { and, eq, gt } from "drizzle-orm";

import { magicLinks, runners, teams } from "@/db/schema";
import { getDb } from "@/lib/db";
import { appAbsoluteUrl } from "@/lib/app-url";
import { isCaptainRunner } from "@/features/team/data";
import { setTeamSession } from "@/lib/auth/team-session";
import { defaultLocale, locales } from "@/lib/i18n/config";

/**
 * Consumes a registration magic link (`/dashboard?token=...`).
 *
 * Registration emails issue a long-lived (30-day) link whose raw token is
 * stored directly in `magicLinks.token` (distinct from the single-use,
 * sha256-hashed team-login links used by `/team/[code]/verify`). This handler
 * validates the token and:
 *   - team runners (captain / member) → set the team session, land on the
 *     team dashboard `/team/[code]`;
 *   - solo / free-agent runners (no team) → land on their ticket page.
 *
 * Unlike the team-login link, this one is intentionally NOT single-use: the
 * runner can reopen it from their inbox any time until it expires.
 *
 * Redirects use `NEXT_PUBLIC_APP_URL` — not `request.url` — so a click never
 * lands on the Vercel deployment hostname after a custom domain is attached.
 */
function withLocale(locale: string, path: string) {
  const prefix = locale === defaultLocale ? "" : `/${locale}`;
  return `${prefix}${path}`;
}

function safeLocale(value: string) {
  return (locales as readonly string[]).includes(value) ? value : defaultLocale;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ locale: string }> },
) {
  const { locale: rawLocale } = await params;
  const locale = safeLocale(rawLocale);
  const token = new URL(request.url).searchParams.get("token");

  const landing = () => NextResponse.redirect(appAbsoluteUrl(withLocale(locale, "/")));

  if (!token) return landing();

  const db = getDb();

  const [link] = await db
    .select()
    .from(magicLinks)
    .where(and(eq(magicLinks.token, token), gt(magicLinks.expiresAt, new Date())))
    .limit(1);

  if (!link || !link.runnerId) return landing();

  const [runner] = await db
    .select()
    .from(runners)
    .where(eq(runners.id, link.runnerId))
    .limit(1);

  if (!runner) return landing();

  // Team runner → open the team dashboard with an active session.
  if (link.teamId) {
    const [team] = await db.select().from(teams).where(eq(teams.id, link.teamId)).limit(1);
    if (team) {
      await setTeamSession({
        teamId: team.id,
        teamCode: team.code,
        email: link.email,
        runnerId: runner.id,
        role: isCaptainRunner(runner) ? "captain" : "member",
      });
      return NextResponse.redirect(
        appAbsoluteUrl(withLocale(locale, `/team/${encodeURIComponent(team.code)}`)),
      );
    }
  }

  // Solo / free-agent runner → their ticket page.
  return NextResponse.redirect(
    appAbsoluteUrl(withLocale(locale, `/ticket/${runner.id}`)),
  );
}
