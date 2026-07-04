import Stripe from "stripe";

export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2026-05-27.dahlia",
      typescript: true,
    })
  : null;

export function getStripe() {
  if (!stripe) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }

  return stripe;
}

export const REGISTRATION_PRICE_PLN = 5000; // 50.00 PLN in groszy
