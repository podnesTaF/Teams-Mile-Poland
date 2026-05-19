import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";

import { promotePendingRegistration } from "@/features/registration/data";
import { sendRegistrationEmails } from "@/features/registration/email";
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

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    if (session.payment_status === "paid") {
      const stored = await promotePendingRegistration(session.id);
      if (stored && "runnerEmail" in stored) {
        await sendRegistrationEmails({ stored });
      }
    }
  }

  return NextResponse.json({ received: true });
}
