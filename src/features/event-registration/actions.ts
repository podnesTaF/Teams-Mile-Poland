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
import { minorToAcer } from "@/features/wallet/config";
import { getAcerBalance } from "@/features/wallet/data";
import { individualEntryFeeMinor } from "@/features/wallet/entry-fees";

import {
  buildConsentRows,
  termsAcceptedFrom,
  validateConsentItems,
} from "@/lib/legal/consent";
import type { DocSet } from "@/lib/legal/manifest";

import { createRegistrationWithConsent, hasRegistration, isInsufficientAcer } from "./data";
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
  formatDateOnly,
} from "@/lib/age";
import { acceptsIndividuals } from "@/lib/events/types";

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

/**
 * How much ACER the runner is short, in **whole ACER** — the unit the copy
 * prints (`register.fee.insufficientBody` says "{needed} ACER … holds
 * {balance}") and the unit an admin prices a night in. Minor units are the
 * ledger's business and never reach a sentence. Both numbers are carried
 * because a runner who is short must never be left to work out by how much.
 */
export type AcerShortfall = { needed: number; balance: number };

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
        | "insufficient_acer"
        | "error";
      message: string;
      /** Present only when `reason === "consent"`. */
      consent?: ConsentRefusal;
      /** Present only when `reason === "insufficient_acer"`. */
      shortfall?: AcerShortfall;
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
 * Register the signed-in user for an individual event, **record what they
 * accepted and take the entry fee**, in one transaction (ADR 0006, ADR 0013).
 * Uncapped; free unless the night is priced.
 *
 * Guards, in order: session → email verified → profile complete → 18 on the
 * event date → event open → not already registered → **enough ACER** → the
 * consent submission is valid against the manifest. The consent check is
 * re-derived server-side from `CONSENT_ITEMS`, so a client that omits a required
 * box, ticks the image question instead of answering it, or invents an item id
 * is refused regardless of what it rendered.
 *
 * The balance sits where it does on purpose: it is a fact about the runner and
 * the night, like the duplicate check above it and unlike the submission below
 * it, and this order means nobody is sent back to fix a checkbox on a
 * registration their wallet cannot finish anyway. It is only a courtesy — the
 * re-read under the per-user lock inside `createRegistrationWithConsent` is what
 * is actually true, and it comes back here as the same refusal.
 *
 * On success a ticket email is sent. The email is deliberately *outside* the
 * transaction: a failed send must not roll back a valid registration, its
 * consent evidence or its debit, and the ticket can be re-sent.
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
  if (!acceptsIndividuals(event)) {
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

  // Priced once, here, and handed down: the number the balance is judged against
  // and the number that is charged cannot differ, even across a re-pricing
  // mid-request. Never the column directly — `individualEntryFeeMinor` is the
  // single answer to "what does this night cost a runner" (ADR 0013).
  const feeMinor = individualEntryFeeMinor(event);
  if (feeMinor > 0) {
    const balanceMinor = await getAcerBalance(user.id);
    if (balanceMinor < feeMinor) return insufficientAcer(feeMinor, balanceMinor);
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

  // The set is the flow's, not the client's: this is the individual register
  // flow, so the individual corpus applies — on a `mixed` night too, where the
  // team corpus belongs to the team confirmation screen (ADR 0009). A submission
  // naming the other corpus would otherwise be validated against items this
  // flow never showed.
  const docSet: DocSet = "individual";
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
          birthDate: formatDateOnly(dob),
          phoneEmail: phoneEmailLine({ email: user.email, phone: profile.phone }),
          address: submission.address ?? "",
          emergencyContact: submission.emergencyContact,
        },
        ip: requestIp(requestHeaders),
        userAgent: requestHeaders.get("user-agent"),
      },
      consents: buildConsentRows(docSet, submission.items),
      feeMinor,
    });
    await sendEventTicketEmail({ registration, user });
    return { ok: true, ticketUrl: makeEventTicketUrl(registration.id, { locale }) };
  } catch (error) {
    // The transaction's own verdict, taken under the runner's lock — it beats
    // the pre-check above, which a concurrent spend can have made stale between
    // the two reads. Nothing was written: the throw rolled the registration and
    // its consent rows back with the debit.
    if (isInsufficientAcer(error)) {
      return insufficientAcer(feeMinor, await getAcerBalance(user.id));
    }
    if (error instanceof Error && /unique|duplicate/i.test(error.message)) {
      return { ok: false, reason: "duplicate", message: "You're already registered." };
    }
    return { ok: false, reason: "error", message: "Registration failed. Please try again." };
  }
}

/**
 * The shortfall refusal, built from minor units in one place so the two sites
 * that can raise it — the pre-check and the caught throw — can never report the
 * amount in different units or round it differently. `message` is a log/fallback
 * sentence; what the screen renders is `register.fee.insufficient*` filled from
 * {@link AcerShortfall}, because a refusal is a key, not a sentence.
 */
function insufficientAcer(feeMinor: number, balanceMinor: number): RegisterResult {
  return {
    ok: false,
    reason: "insufficient_acer",
    message: "Not enough ACER in your wallet for this entry.",
    shortfall: { needed: minorToAcer(feeMinor), balance: minorToAcer(Math.max(balanceMinor, 0)) },
  };
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
  if (!acceptsIndividuals(event)) {
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
