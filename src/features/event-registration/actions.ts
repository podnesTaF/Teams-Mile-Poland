"use server";

import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";

import { accounts, users } from "@/db/schema";
import { getDb } from "@/lib/db";
import { getEventBySlug } from "@/lib/events/registry";
import { auth } from "@/lib/auth/better-auth";
import { isProfileComplete } from "@/lib/auth/user-session";

import { createFreeRegistration, hasRegistration } from "./data";
import { guestRegisterSchema, type GuestRegisterInput } from "./schemas";
import { makeEventTicketUrl, sendEventTicketEmail } from "./ticket";

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
  if (!isProfileComplete(user)) {
    return { ok: false, reason: "profile", message: "Complete your profile before registering." };
  }

  const event = getEventBySlug(eventSlug);
  if (!event || event.eventType !== "individual") {
    return { ok: false, reason: "notfound", message: "Event not found." };
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
  | { ok: true; ticketUrl: string }
  | {
      ok: false;
      reason: "invalid" | "notfound" | "closed" | "exists" | "error";
      message: string;
      fieldErrors?: Record<string, string[]>;
    };

/**
 * Passwordless "register for event" for logged-out visitors. Creates a runner
 * account + `credential` account (unusable placeholder password), registers
 * them, emails the ticket, and sends a set-password link so they can access
 * their profile later. `emailVerified` is true so that — once they set a
 * password via the emailed link — they can sign in; the missing password is
 * what gates sign-in until then. Existing emails are bounced to sign-in.
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

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing.length > 0) {
    return {
      ok: false,
      reason: "exists",
      message: "You already have an account — sign in to register.",
    };
  }

  const userId = randomUUID();
  const fullName = `${data.firstName} ${data.lastName}`.trim();

  try {
    await db.insert(users).values({
      id: userId,
      name: fullName,
      email,
      emailVerified: true,
      firstName: data.firstName,
      lastName: data.lastName,
      dateOfBirth: new Date(data.dateOfBirth),
      sex: data.sex,
      club: data.club || "",
      locale,
    });
    // Credential account with an unusable password — the set-password email
    // (below) lets the runner set a real one before they can sign in.
    await db.insert(accounts).values({
      id: randomUUID(),
      accountId: userId,
      providerId: "credential",
      userId,
      password: randomUUID(),
    });

    const registration = await createFreeRegistration({ eventSlug, userId, locale });
    await sendEventTicketEmail({
      registration,
      user: { email, name: fullName, firstName: data.firstName, lastName: data.lastName, club: data.club || null },
    });

    // Set-password ("welcome") email — reuses the configured reset flow.
    try {
      await auth.api.requestPasswordReset({ body: { email, redirectTo: "/auth/reset-password" } });
    } catch {
      // Non-fatal: they're registered and have their ticket regardless.
    }

    return { ok: true, ticketUrl: makeEventTicketUrl(registration.id, { locale }) };
  } catch (error) {
    if (error instanceof Error && /unique|duplicate/i.test(error.message)) {
      return { ok: false, reason: "exists", message: "You already have an account — sign in to register." };
    }
    return { ok: false, reason: "error", message: "Registration failed. Please try again." };
  }
}
