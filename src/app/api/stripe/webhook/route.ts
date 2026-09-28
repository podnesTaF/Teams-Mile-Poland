import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";

import { promotePendingRegistration } from "@/features/registration/data";
import { sendRegistrationEmails } from "@/features/registration/email";
import { EVENT_ENTRY_KIND } from "@/features/event-payments/checkout";
import { expireEventPayment, fulfilEventPayment } from "@/features/event-payments/fulfil";
import { ACER_PURCHASE_KIND, creditAcerPurchase } from "@/features/wallet/purchase";
import { getStripe } from "@/lib/stripe";

export async function POST(request: Request) {
  const stripe = getStripe();
  const signature = (await headers()).get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Missing Stripe webhook configuration" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    const body = await request.text();
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid webhook signature" },
      { status: 400 },
    );
  }

  // Entry fees for paid nights (`features/event-payments`). Handled before
  // everything else and **returns**, so neither the ACER top-up nor the legacy
  // flow ever sees an entry-fee session. `async_payment_*` covers methods that
  // settle after the redirect (bank transfers); `completed` with
  // `payment_status: "unpaid"` is such a method still on its way and is ignored
  // until `async_payment_succeeded` arrives. 500 on a thrown error so Stripe
  // retries — the claim inside makes the retry safe.
  if (
    (event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded" ||
      event.type === "checkout.session.expired" ||
      event.type === "checkout.session.async_payment_failed") &&
    event.data.object.metadata?.kind === EVENT_ENTRY_KIND
  ) {
    const session = event.data.object;
    try {
      if (
        event.type === "checkout.session.expired" ||
        event.type === "checkout.session.async_payment_failed"
      ) {
        await expireEventPayment(session);
        return NextResponse.json({ received: true, outcome: "expired" });
      }
      const outcome = await fulfilEventPayment(session);
      return NextResponse.json({ received: true, outcome });
    } catch (error) {
      console.error(`[event-payments] fulfilling session ${session.id} failed:`, error);
      return NextResponse.json({ error: "Could not fulfil the entry" }, { status: 500 });
    }
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    // ACER top-up (#49). This branch **returns**, so the legacy team-checkout
    // block below never sees an ACER session and keeps its exact previous
    // behaviour — the two flows share only this route.
    //
    // A failure here answers 500 on purpose: Stripe retries, and the credit is
    // keyed by the session id, so the retry either lands the credit or finds it
    // already there. Swallowing the error would lose a paid top-up silently.
    if (session.metadata?.kind === ACER_PURCHASE_KIND) {
      try {
        const outcome = await creditAcerPurchase(session);
        return NextResponse.json({ received: true, outcome });
      } catch (error) {
        console.error(`[wallet] crediting ACER session ${session.id} failed:`, error);
        return NextResponse.json({ error: "Could not credit the purchase" }, { status: 500 });
      }
    }

    // Legacy team registration flow (individual events are free — no checkout).
    if (session.payment_status === "paid") {
      const stored = await promotePendingRegistration(session.id);
      if (stored && "runnerEmail" in stored) {
        await sendRegistrationEmails({ stored });
      }
    }
  }

  return NextResponse.json({ received: true });
}
