"use server";

import { headers } from "next/headers";

import { getEventBySlug } from "@/lib/events/registry";
import { auth } from "@/lib/auth/better-auth";
import { isProfileComplete } from "@/lib/auth/user-session";

import { createFreeRegistration, hasRegistration } from "./data";
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
