"use server";

import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";

import { users } from "@/db/schema";
import { getDb } from "@/lib/db";
import { getEventBySlug } from "@/lib/events/registry";
import { auth } from "@/lib/auth/better-auth";
import { canRegister } from "@/lib/auth/user-session";
import { defaultLocale } from "@/lib/i18n/config";

import { createFreeRegistration, hasRegistration } from "./data";
import { guestRegisterSchema, type GuestRegisterInput } from "./schemas";
import { makeEventTicketUrl, sendEventTicketEmail } from "./ticket";
import {
  coerceToDate,
  meetsMinParticipantAge,
  MIN_PARTICIPANT_AGE_ERROR,
  parseDateOnly,
} from "@/lib/age";

/**
 * Locale-aware return path baked into the verification link. On click, Better
 * Auth verifies + auto-signs-in, then redirects here; the `?verified=1` marker
 * tells the confirm island to auto-complete the registration.
 */
function verifiedCallbackPath(locale: string, eventSlug: string): string {
  const prefix = locale === defaultLocale ? "" : `/${locale}`;
  return `${prefix}/events/${eventSlug}/register?verified=1`;
}

export type RegisterResult =
  | { ok: true; ticketUrl: string }
  | {
      ok: false;
      reason: "auth" | "verify" | "profile" | "notfound" | "closed" | "duplicate" | "error";
      message: string;
    };

/**
 * Register the signed-in user for an individual event. Registration is free and
 * uncapped. Guards, in order: session → email verified → profile complete →
 * event open → not already registered. On success a ticket email is sent.
 */
export async function registerForEvent(eventSlug: string): Promise<RegisterResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  const user = session?.user;
  if (!user) return { ok: false, reason: "auth", message: "Please sign in to register." };
  if (!user.emailVerified) {
    return { ok: false, reason: "verify", message: "Verify your email before registering." };
  }
  if (!canRegister(user)) {
    return { ok: false, reason: "profile", message: "Complete your profile before registering." };
  }

  const event = getEventBySlug(eventSlug);
  if (!event || event.eventType !== "individual") {
    return { ok: false, reason: "notfound", message: "Event not found." };
  }

  const dob = coerceToDate((user as { dateOfBirth?: unknown }).dateOfBirth);
  if (!dob || !meetsMinParticipantAge(dob, parseDateOnly(event.date))) {
    return {
      ok: false,
      reason: "profile",
      message: MIN_PARTICIPANT_AGE_ERROR,
    };
  }

  if (event.status !== "registration_open") {
    return { ok: false, reason: "closed", message: "Registration is not open for this event." };
  }

  if (await hasRegistration(eventSlug, user.id)) {
    return { ok: false, reason: "duplicate", message: "You're already registered for this event." };
  }

  const locale = (user as { locale?: string | null }).locale ?? "pl";

  try {
    const registration = await createFreeRegistration({ eventSlug, userId: user.id, locale });
    await sendEventTicketEmail({ registration, user });
    return { ok: true, ticketUrl: makeEventTicketUrl(registration.id, { locale }) };
  } catch (error) {
    if (error instanceof Error && /unique|duplicate/i.test(error.message)) {
      return { ok: false, reason: "duplicate", message: "You're already registered." };
    }
    return { ok: false, reason: "error", message: "Registration failed. Please try again." };
  }
}

export type GuestRegisterResult =
  | { ok: true; pending: true }
  | {
      ok: false;
      reason: "invalid" | "notfound" | "closed" | "exists" | "error";
      message: string;
      fieldErrors?: Record<string, string[]>;
    };

/**
 * Passwordless **email-verification-gated** registration for logged-out
 * visitors (ADR-0002). Creates an **unverified** account via Better Auth
 * `signUpEmail` (random placeholder password; profile fields as
 * additionalFields) — no registration row and no ticket yet. Better Auth's
 * `sendOnSignUp` mails the verification link, whose `callbackURL` returns to
 * `/events/[slug]/register?verified=1`; the confirm island then completes the
 * registration and sends the ticket.
 *
 * Repeat submissions of an **unverified** email refresh the stored profile
 * fields and re-send the link (idempotent — no duplicate account). An existing
 * **verified** email is bounced to sign-in.
 */
export async function registerAsGuest(
  eventSlug: string,
  raw: GuestRegisterInput,
  locale: string,
): Promise<GuestRegisterResult> {
  const parsed = guestRegisterSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      reason: "invalid",
      message: "Check the highlighted fields and try again.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const event = getEventBySlug(eventSlug);
  if (!event || event.eventType !== "individual") {
    return { ok: false, reason: "notfound", message: "Event not found." };
  }
  if (event.status !== "registration_open") {
    return { ok: false, reason: "closed", message: "Registration is not open for this event." };
  }

  const data = parsed.data;
  const email = data.email.trim().toLowerCase();
  const db = getDb();

  if (!meetsMinParticipantAge(data.dateOfBirth, parseDateOnly(event.date))) {
    return {
      ok: false,
      reason: "invalid",
      message: "Check the highlighted fields and try again.",
      fieldErrors: { dateOfBirth: [MIN_PARTICIPANT_AGE_ERROR] },
    };
  }

  const fullName = `${data.firstName} ${data.lastName}`.trim();
  const callbackURL = verifiedCallbackPath(locale, eventSlug);

  const [existing] = await db
    .select({ id: users.id, emailVerified: users.emailVerified })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing) {
    if (existing.emailVerified) {
      return {
        ok: false,
        reason: "exists",
        message: "You already have an account — sign in to register.",
      };
    }
    // Unverified account already exists → refresh stored fields and re-send the
    // verification link. Never a second account or registration.
    try {
      await db
        .update(users)
        .set({
          name: fullName,
          firstName: data.firstName,
          lastName: data.lastName,
          dateOfBirth: new Date(data.dateOfBirth),
          sex: data.sex,
          club: data.club || "",
          phone: data.phone,
          locale,
        })
        .where(eq(users.id, existing.id));
      await auth.api.sendVerificationEmail({ body: { email, callbackURL } });
      return { ok: true, pending: true };
    } catch {
      return { ok: false, reason: "error", message: "Registration failed. Please try again." };
    }
  }

  // New unverified account. `signUpEmail` honours the configured
  // `requireEmailVerification` / `sendOnSignUp`, so no session is created and
  // the verification link is mailed. The placeholder password is unusable until
  // the runner sets a real one via the ticket email's set-password CTA.
  // Browser headers are forwarded so the `user.create.after` hook can read the
  // referral cookie — a server-side api call carries none by default.
  try {
    await auth.api.signUpEmail({
      headers: await headers(),
      body: {
        email,
        password: randomUUID(),
        name: fullName,
        firstName: data.firstName,
        lastName: data.lastName,
        dateOfBirth: new Date(data.dateOfBirth),
        sex: data.sex,
        club: data.club || "",
        phone: data.phone,
        locale,
        callbackURL,
      },
    });
    return { ok: true, pending: true };
  } catch (error) {
    // A verified account created between the check and now, or any unique clash.
    if (error instanceof Error && /exist|unique|duplicate|already/i.test(error.message)) {
      return { ok: false, reason: "exists", message: "You already have an account — sign in to register." };
    }
    return { ok: false, reason: "error", message: "Registration failed. Please try again." };
  }
}
