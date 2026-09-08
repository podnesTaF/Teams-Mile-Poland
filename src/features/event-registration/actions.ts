"use server";

import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";

import { users } from "@/db/schema";
import { getDb } from "@/lib/db";
import { getEventBySlug } from "@/lib/events/registry";
import { auth } from "@/lib/auth/better-auth";
import { canRegister } from "@/lib/auth/user-session";
import { defaultLocale } from "@/lib/i18n/config";
import { toE164 } from "@/lib/phone";
import { applyReferralAttribution, REF_COOKIE } from "@/features/referral/data";

import {
  buildConsentRows,
  termsAcceptedFrom,
  validateConsentItems,
} from "@/lib/legal/consent";
import { docSetForEventType } from "@/lib/legal/manifest";

import { createRegistrationWithConsent, hasRegistration } from "./data";
import {
  consentSubmissionSchema,
  type ConsentSubmissionInput,
  guestRegisterSchema,
  type GuestRegisterInput,
} from "./schemas";
import { makeEventTicketUrl, sendEventTicketEmail } from "./ticket";
import {
  coerceToDate,
  meetsMinParticipantAge,
  MIN_PARTICIPANT_AGE_ERROR,
  parseDateOnly,
} from "@/lib/age";

/**
 * Locale-aware return path baked into the verification link. On click, Better
 * Auth verifies + auto-signs-in, then redirects here — to the confirm step,
 * which shows the documents and waits for a real submission.
 *
 * The `?verified=1` marker that used to auto-complete the registration is gone
 * (ADR 0006). Acceptance and the participation it covers have to be one atomic
 * act: a guest who filled the form on Tuesday cannot be deemed on Thursday to
 * have accepted a set of documents they were never shown. That costs one click
 * and buys the invariant.
 */
function verifiedCallbackPath(locale: string, eventSlug: string): string {
  const prefix = locale === defaultLocale ? "" : `/${locale}`;
  return `${prefix}/events/${eventSlug}/register`;
}

/**
 * Field-level detail for a refused consent submission, so the form can point at
 * the box the runner missed instead of showing a banner and letting them hunt
 * (user story 12). Ids are `ConsentItem.id`s; `fields` names a text input.
 */
export type ConsentRefusal = {
  missing: string[];
  invalid: string[];
  unknown: string[];
  fields: Record<string, string>;
};

export type RegisterResult =
  | { ok: true; ticketUrl: string }
  | {
      ok: false;
      reason:
        | "auth"
        | "verify"
        | "profile"
        | "age"
        | "notfound"
        | "closed"
        | "duplicate"
        | "consent"
        | "error";
      message: string;
      /** Present only when `reason === "consent"`. */
      consent?: ConsentRefusal;
    };

/** The `phoneEmail` line the Statement prints, from whatever the profile holds. */
function phoneEmailLine(user: { email: string; phone?: string | null }): string {
  return [user.phone?.trim(), user.email].filter(Boolean).join(" · ");
}

/**
 * Best-effort request IP. `x-forwarded-for` is a comma-separated chain where the
 * client is first; Vercel additionally sets `x-real-ip`. Nullable on purpose —
 * an absent IP is recorded as absent, never as a guess.
 */
function requestIp(h: Headers): string | null {
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim() || null;
  return h.get("x-real-ip");
}

/**
 * Register the signed-in user for an individual event **and record what they
 * accepted**, in one transaction (ADR 0006). Registration is free and uncapped.
 *
 * Guards, in order: session → email verified → profile complete → 18 on the
 * event date → event open → not already registered → the consent submission is
 * valid against the manifest. The last one is re-derived server-side from
 * `CONSENT_ITEMS`, so a client that omits a required box, ticks the image
 * question instead of answering it, or invents an item id is refused regardless
 * of what it rendered.
 *
 * On success a ticket email is sent. The email is deliberately *outside* the
 * transaction: a failed send must not roll back a valid registration and its
 * consent evidence, and the ticket can be re-sent.
 */
export async function registerForEvent(
  eventSlug: string,
  consent: ConsentSubmissionInput,
): Promise<RegisterResult> {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  const user = session?.user;
  if (!user) return { ok: false, reason: "auth", message: "Please sign in to register." };
  if (!user.emailVerified) {
    return { ok: false, reason: "verify", message: "Verify your email before registering." };
  }
  if (!canRegister(user)) {
    return { ok: false, reason: "profile", message: "Complete your profile before registering." };
  }

  const event = await getEventBySlug(eventSlug);
  if (!event || event.eventType !== "individual") {
    return { ok: false, reason: "notfound", message: "Event not found." };
  }

  const dob = coerceToDate((user as { dateOfBirth?: unknown }).dateOfBirth);
  if (!dob || !meetsMinParticipantAge(dob, parseDateOnly(event.date))) {
    return {
      ok: false,
      reason: "age",
      message: MIN_PARTICIPANT_AGE_ERROR,
    };
  }

  if (event.status !== "registration_open") {
    return { ok: false, reason: "closed", message: "Registration is not open for this event." };
  }

  if (await hasRegistration(eventSlug, user.id)) {
    return { ok: false, reason: "duplicate", message: "You're already registered for this event." };
  }

  const parsed = consentSubmissionSchema.safeParse(consent);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors as Record<string, string[]>;
    return {
      ok: false,
      reason: "consent",
      message: "Check the consent section and try again.",
      consent: {
        missing: [],
        invalid: [],
        unknown: [],
        fields: Object.fromEntries(
          Object.entries(fieldErrors).map(([key, messages]) => [key, messages[0] ?? "Invalid"]),
        ),
      },
    };
  }
  const submission = parsed.data;

  // The set is the event's, not the client's. A submission naming the other
  // corpus would otherwise be validated against items this event never showed.
  const docSet = docSetForEventType(event.eventType);
  if (submission.docSet !== docSet) {
    return { ok: false, reason: "consent", message: "Check the consent section and try again." };
  }

  const problem = validateConsentItems(docSet, submission.items);
  if (problem) {
    return {
      ok: false,
      reason: "consent",
      message: "Please answer every required item before confirming.",
      consent: { ...problem, fields: {} },
    };
  }

  // The language the documents were actually shown in — not the profile
  // preference, which may differ from the page the runner read.
  const locale = submission.locale;
  const profile = user as typeof user & {
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
  };
  const fullName =
    [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim() ||
    user.name ||
    user.email;

  try {
    const registration = await createRegistrationWithConsent({
      registration: {
        eventSlug,
        userId: user.id,
        locale,
        terms: termsAcceptedFrom(docSet, submission.items),
      },
      submission: {
        docSet,
        locale,
        snapshot: {
          fullName,
          birthDate: dob.toISOString().slice(0, 10),
          phoneEmail: phoneEmailLine({ email: user.email, phone: profile.phone }),
          address: submission.address ?? "",
          emergencyContact: submission.emergencyContact,
        },
        ip: requestIp(requestHeaders),
        userAgent: requestHeaders.get("user-agent"),
      },
      consents: buildConsentRows(docSet, submission.items),
    });
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
      reason: "invalid" | "age" | "notfound" | "closed" | "exists" | "error";
      message: string;
      fieldErrors?: Record<string, string[]>;
    };

/**
 * Passwordless **email-verification-gated** registration for logged-out
 * visitors (ADR-0002). Creates an **unverified** account via Better Auth
 * `signUpEmail` (random placeholder password; profile fields as
 * additionalFields) — no registration row and no ticket yet. Better Auth's
 * `sendOnSignUp` mails the verification link, whose `callbackURL` returns to
 * `/events/[slug]/register` — the confirm step, where the runner reads the
 * documents, gives their consents and submits. Only that submission creates the
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

  const event = await getEventBySlug(eventSlug);
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
      reason: "age",
      message: MIN_PARTICIPANT_AGE_ERROR,
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
          // This branch writes straight to the table, so it is outside the
          // Better Auth user-update hook that derives this everywhere else
          // (`derivePhoneE164` in `src/lib/auth/better-auth.ts`) — derive it
          // here or the refreshed row keeps the previous attempt's key.
          phoneE164: toE164(data.phone),
          locale,
        })
        .where(eq(users.id, existing.id));
      // This branch updates an account in place, so the `user.create.after`
      // hook that normally applies the referral cookie never fires — read it
      // here or a referred runner who retries with the same email is lost to
      // attribution. First-writer-wins semantics make the repeat call safe.
      await applyReferralAttribution(existing.id, (await cookies()).get(REF_COOKIE)?.value);
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
      return {
        ok: false,
        reason: "exists",
        message: "You already have an account — sign in to register.",
      };
    }
    return { ok: false, reason: "error", message: "Registration failed. Please try again." };
  }
}
