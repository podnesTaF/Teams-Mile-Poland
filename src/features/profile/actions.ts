"use server";

import { headers } from "next/headers";

import { auth } from "@/lib/auth/better-auth";
import { locales, type Locale } from "@/lib/i18n/config";

import { profileSchema, type ProfileInput, type ProfileResult } from "./schemas";

/**
 * Update the signed-in user's profile fields. Validated server-side with zod,
 * then written via Better Auth's update-user API (which enforces the session).
 * `dateOfBirth` is passed as a Date to match the additionalField type "date".
 */
export async function updateProfile(input: ProfileInput): Promise<ProfileResult> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Check the highlighted fields and try again.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { firstName, lastName, dateOfBirth, sex, club, phone } = parsed.data;

  try {
    await auth.api.updateUser({
      headers: await headers(),
      body: {
        name: `${firstName} ${lastName}`.trim(),
        firstName,
        lastName,
        dateOfBirth: new Date(dateOfBirth),
        sex,
        // string-typed additionalField — store "" rather than null when blank.
        club: club || "",
        phone,
      },
    });
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not save your profile.",
    };
  }
}

/**
 * Persist the site language picked in the header switcher onto the account.
 * `users.locale` drives the language of every outbound email (tickets, heat
 * assignments, broadcasts); without this it stays frozen at whatever URL
 * locale the user happened to sign up under. Fire-and-forget from the client:
 * signed-out visitors and failures are silent no-ops — the page language
 * switch must never be blocked by this write.
 */
export async function syncUserLocale(locale: string): Promise<void> {
  if (!locales.includes(locale as Locale)) return;

  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session || session.user.locale === locale) return;

    await auth.api.updateUser({
      headers: await headers(),
      body: { locale },
    });
  } catch {
    // Best-effort preference sync — never surface to the switcher.
  }
}
