"use server";

import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { runners, teams } from "@/db/schema";
import { getAppUrl } from "@/features/registration/data";
import { clearTeamSession, getTeamSession } from "@/lib/auth/team-session";
import { getDb } from "@/lib/db";
import { defaultLocale, locales, type Locale } from "@/lib/i18n/config";

import {
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_WINDOW_MS,
} from "./constants";
import {
  countRecentMagicLinks,
  findRunnerByEmail,
  getTeamByCode,
  normalizeEmail,
  normalizeTeamCode,
} from "./data";
import { sendLoginMagicLink } from "./email";
import { createLoginMagicLink } from "./tokens";

const accessSchema = z.object({
  email: z.string().email("Enter a valid email"),
});

function pickLocale(value: FormDataEntryValue | null): Locale {
  if (typeof value === "string" && (locales as readonly string[]).includes(value)) {
    return value as Locale;
  }
  return defaultLocale;
}

function teamPathFor(locale: Locale, code: string) {
  const prefix = locale === defaultLocale ? "" : `/${locale}`;
  return `${prefix}/team/${encodeURIComponent(code)}`;
}

export async function requestAccess(formData: FormData) {
  const rawCode = String(formData.get("code") ?? "").trim();
  const code = normalizeTeamCode(rawCode);
  const locale = pickLocale(formData.get("locale"));
  if (!code) {
    redirect(`${teamPathFor(locale, code)}/access?error=invalid`);
  }

  const parsed = accessSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    redirect(`${teamPathFor(locale, code)}/access?error=email`);
  }

  const email = normalizeEmail(parsed.data.email);
  const team = await getTeamByCode(code);

  if (team) {
    const recent = await countRecentMagicLinks(team.id, email, RATE_LIMIT_WINDOW_MS);
    if (recent < RATE_LIMIT_MAX_REQUESTS) {
      const runner = await findRunnerByEmail(team.id, email);
      if (runner) {
        const { rawToken, expiresAt } = await createLoginMagicLink({
          teamId: team.id,
          email,
          runnerId: runner.id,
        });
        const url =
          `${getAppUrl()}${teamPathFor(locale, team.code)}/verify` +
          `?token=${encodeURIComponent(rawToken)}`;
        await sendLoginMagicLink({
          to: email,
          url,
          teamCode: team.code,
          teamName: team.name,
          locale,
          expiresAt,
        });
      }
    }
  }

  redirect(`${teamPathFor(locale, code)}/access?sent=1`);
}

async function requireCaptainSession(teamCode: string) {
  const session = await getTeamSession();
  const normalized = normalizeTeamCode(teamCode);
  if (!session || session.role !== "captain" || session.teamCode !== normalized) {
    throw new Error("Forbidden");
  }
  return session;
}

export async function signOut(formData: FormData) {
  const locale = pickLocale(formData.get("locale"));
  const code = normalizeTeamCode(String(formData.get("code") ?? ""));
  await clearTeamSession();
  redirect(`${teamPathFor(locale, code)}/access`);
}

const renameSchema = z.object({
  name: z.string().trim().min(2, "Team name is too short").max(80),
});

export async function renameTeam(formData: FormData) {
  const code = normalizeTeamCode(String(formData.get("code") ?? ""));
  const locale = pickLocale(formData.get("locale"));
  const session = await requireCaptainSession(code);

  const parsed = renameSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    redirect(`${teamPathFor(locale, code)}?error=rename`);
  }

  await getDb().update(teams).set({ name: parsed.data.name }).where(eq(teams.id, session.teamId));
  revalidatePath(teamPathFor(locale, code));
}

export async function removeMember(formData: FormData) {
  const code = normalizeTeamCode(String(formData.get("code") ?? ""));
  const locale = pickLocale(formData.get("locale"));
  const session = await requireCaptainSession(code);
  const runnerId = String(formData.get("runnerId") ?? "").trim();
  if (!runnerId) {
    redirect(`${teamPathFor(locale, code)}?error=missing-runner`);
  }

  await getDb()
    .delete(runners)
    .where(
      and(
        eq(runners.id, runnerId),
        eq(runners.teamId, session.teamId),
        eq(runners.registrationType, "team_member"),
      ),
    );

  revalidatePath(teamPathFor(locale, code));
}

const editMemberSchema = z.object({
  fullName: z.string().trim().min(2, "Name is too short").max(120),
  email: z.string().trim().email("Enter a valid email"),
});

export async function editMember(formData: FormData) {
  const code = normalizeTeamCode(String(formData.get("code") ?? ""));
  const locale = pickLocale(formData.get("locale"));
  const session = await requireCaptainSession(code);

  const runnerId = String(formData.get("runnerId") ?? "").trim();
  const parsed = editMemberSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
  });

  if (!runnerId || !parsed.success) {
    redirect(`${teamPathFor(locale, code)}?error=edit`);
  }

  // Scope the update to a runner on the captain's own team.
  await getDb()
    .update(runners)
    .set({ fullName: parsed.data.fullName, email: normalizeEmail(parsed.data.email) })
    .where(and(eq(runners.id, runnerId), eq(runners.teamId, session.teamId)));

  revalidatePath(teamPathFor(locale, code));
}

export async function regenerateCode(formData: FormData) {
  const code = normalizeTeamCode(String(formData.get("code") ?? ""));
  const locale = pickLocale(formData.get("locale"));
  const session = await requireCaptainSession(code);

  const db = getDb();
  const slug = session.teamCode.split("-").slice(0, 2).join("-") || "WAW-TEAM";
  let newCode = "";
  for (let i = 0; i < 5; i += 1) {
    const candidate = `${slug}-${nanoid(4).toUpperCase()}`;
    const [existing] = await db
      .select({ id: teams.id })
      .from(teams)
      .where(eq(teams.code, candidate))
      .limit(1);
    if (!existing) {
      newCode = candidate;
      break;
    }
  }
  if (!newCode) {
    newCode = `${slug}-${nanoid(8).toUpperCase()}`;
  }

  await db.update(teams).set({ code: newCode }).where(eq(teams.id, session.teamId));
  await clearTeamSession();
  redirect(`${teamPathFor(locale, newCode)}/access?rotated=1`);
}

export async function markRosterFinal(formData: FormData) {
  const code = normalizeTeamCode(String(formData.get("code") ?? ""));
  const locale = pickLocale(formData.get("locale"));
  const session = await requireCaptainSession(code);

  await getDb()
    .update(teams)
    .set({ status: "final", lockedAt: new Date() })
    .where(eq(teams.id, session.teamId));

  revalidatePath(teamPathFor(locale, code));
}
