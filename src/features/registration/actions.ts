"use server";

import { getLocale } from "next-intl/server";

import {
  localeSchema,
  registrationPayloadSchema,
  type RegistrationInput,
  type RegistrationPayload,
  type RegistrationResult,
} from "./schemas";
import {
  createFreeRegistration,
  createPaidRegistration,
  getAppUrl,
  makeInviteUrl,
  validateJoinCode,
} from "./data";
import { sendRegistrationEmails } from "./email";
import { getStripe, REGISTRATION_PRICE_PLN } from "@/lib/stripe";
import { EVENT } from "@/lib/marketing/event";

export async function submitRegistration(payload: RegistrationInput): Promise<RegistrationResult> {
  const parsed = registrationPayloadSchema.safeParse(payload);

  if (!parsed.success) {
    return {
      ok: false,
      message: "Check the highlighted fields and try again.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  // Stamp the registrant's UI locale (drives lifecycle email language).
  // Read server-side so it survives the Stripe pending-payload round-trip.
  const locale = localeSchema.catch("ua").parse(await getLocale());
  const data: RegistrationPayload = { ...parsed.data, locale };

  try {
    if (data.flow === "join") {
      const validation = await validateJoinCode(data.teamCode);
      if (!validation.ok) {
        return { ok: false, message: validation.message };
      }
    }

    const freeStored = await createFreeRegistration(data);

    if (freeStored) {
      await sendRegistrationEmails({ stored: freeStored });
      return {
        ok: true,
        status: "free",
        flow: freeStored.flow,
        runnerEmail: freeStored.runnerEmail,
        teamCode: freeStored.teamCode,
        inviteUrl: freeStored.teamCode ? makeInviteUrl(freeStored.teamCode) : undefined,
      };
    }

    const checkoutUrl = await createCheckout(data);
    return {
      ok: true,
      status: "paid",
      redirectTo: checkoutUrl,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Registration failed. Please try again.",
    };
  }
}

export async function getJoinPreview(code: string) {
  return validateJoinCode(code);
}

async function createCheckout(payload: RegistrationPayload) {
  const stripe = getStripe();
  const appUrl = getAppUrl();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    success_url: `${appUrl}/register/success?checkout={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}${cancelPath(payload)}`,
    customer_email: payload.person.email,
    metadata: {
      flow: payload.flow,
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "pln",
          unit_amount: REGISTRATION_PRICE_PLN,
          product_data: {
            name: `${EVENT.name} registration`,
            description: "One runner entry",
          },
        },
      },
    ],
  });

  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL.");
  }

  await createPaidRegistration(payload, session.id);
  return session.url;
}

function cancelPath(payload: RegistrationPayload) {
  if (payload.flow === "join") return `/join/${encodeURIComponent(payload.teamCode)}`;
  if (payload.flow === "free") return "/register/solo";
  return "/register/team";
}
