"use server";

import { headers } from "next/headers";

import { auth } from "@/lib/auth/better-auth";

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
