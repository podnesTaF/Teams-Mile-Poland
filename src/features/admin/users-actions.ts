"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { users } from "@/db/schema";
import { getDb } from "@/lib/db";
import { auth } from "@/lib/auth/better-auth";
import { getEventBySlug } from "@/lib/events/registry";
import { defaultLocale } from "@/lib/i18n/config";
import {
  createFreeRegistration,
  hasRegistration,
  type EventRegistrationRow,
} from "@/features/event-registration/data";
import { sendEventTicketEmail } from "@/features/event-registration/ticket";

import { adminPath, requireAdmin, safeLocale } from "./action-helpers";

/** Redirect back to a users path with a status message. */
function back(locale: string, suffix: string, msg: string): never {
  revalidatePath(adminPath(locale, "/users"));
  redirect(adminPath(locale, `/users${suffix}?msg=${encodeURIComponent(msg)}`));
}

/** Where the verification link lands after verify + auto-sign-in. */
function eventsCallbackUrl(locale: string): string {
  const prefix = locale === defaultLocale ? "" : `/${locale}`;
  return `${prefix}/events`;
}

/**
 * Delete a user and everything that cascades from it (registrations, legacy
 * participation, sessions, accounts — all FK `on delete cascade`). Returns to
 * the users list. Confirm dialog upstream.
 */
export async function deleteUser(formData: FormData) {
  const locale = safeLocale(formData.get("locale"));
  await requireAdmin(locale);
  const id = String(formData.get("id") ?? "");
  if (!id) back(locale, "", "No user specified.");

  await getDb().delete(users).where(eq(users.id, id));
  back(locale, "", "User deleted.");
}

/**
 * Re-send the Better Auth verification email to an unverified account so an
 * imported or stuck person can claim it; the link lands on the events section.
 * No-op for already-verified accounts. `redirectTo` is a users-path suffix
 * (e.g. "" for the list, "/<id>" for the detail page).
 */
export async function resendUserVerification(formData: FormData) {
  const locale = safeLocale(formData.get("locale"));
  await requireAdmin(locale);
  const id = String(formData.get("id") ?? "");
  const redirectTo = String(formData.get("redirectTo") ?? "");
  if (!id) back(locale, redirectTo, "No user specified.");

  const db = getDb();
  const [user] = await db
    .select({ email: users.email, emailVerified: users.emailVerified })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  if (!user) back(locale, redirectTo, "User not found.");
  if (user.emailVerified) back(locale, redirectTo, "Account is already verified.");

  try {
    await auth.api.sendVerificationEmail({
      body: { email: user.email, callbackURL: eventsCallbackUrl(locale) },
    });
  } catch {
    back(locale, redirectTo, "Could not send the verification email. Try again.");
  }
  back(locale, redirectTo, "Verification email sent.");
}

/**
 * Register a user for an individual event from their detail page and send the
 * normal ticket email. Guards (PRD contract, frozen): user email verified,
 * event exists, lifecycle status not `completed` (`registration_closed` is an
 * allowed admin override), and no existing registration. The verified-email
 * invariant behind every registration holds — no path here creates a row for an
 * unverified account (the button is also disabled upstream for such accounts).
 */
export async function adminRegisterUserForEvent(formData: FormData) {
  const locale = safeLocale(formData.get("locale"));
  await requireAdmin(locale);
  const id = String(formData.get("id") ?? "");
  const eventSlug = String(formData.get("eventSlug") ?? "");
  const suffix = id ? `/${id}` : "";
  if (!id || !eventSlug) back(locale, suffix, "Select an event to register for.");

  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!user) back(locale, suffix, "User not found.");
  if (!user.emailVerified) {
    back(locale, suffix, "User must verify their email before they can be registered.");
  }

  const event = getEventBySlug(eventSlug);
  if (!event || event.eventType !== "individual") back(locale, suffix, "Event not found.");
  if (event.status === "completed") {
    back(locale, suffix, "Cannot register a user for a completed event.");
  }

  if (await hasRegistration(eventSlug, id)) {
    back(locale, suffix, "User is already registered for this event.");
  }

  const ticketLocale = user.locale ?? defaultLocale;
  let registration: EventRegistrationRow;
  try {
    registration = await createFreeRegistration({ eventSlug, userId: id, locale: ticketLocale });
  } catch (error) {
    if (error instanceof Error && /unique|duplicate/i.test(error.message)) {
      back(locale, suffix, "User is already registered for this event.");
    }
    back(locale, suffix, "Could not register the user. Try again.");
  }

  // The row exists now; report accurately if only the ticket email fails so the
  // admin knows the registration stands (rather than seeing a "failed" message
  // and retrying into an "already registered" block).
  try {
    await sendEventTicketEmail({ registration, user });
  } catch {
    back(
      locale,
      suffix,
      `Registered for ${event.name} — ${event.shortDate}, but the ticket email could not be sent.`,
    );
  }
  back(locale, suffix, `Registered for ${event.name} — ${event.shortDate}. Ticket email sent.`);
}
