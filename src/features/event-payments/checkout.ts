import { randomUUID } from "node:crypto";

import { and, desc, eq, inArray } from "drizzle-orm";
import type Stripe from "stripe";

import { users } from "@/db/schema";
import { eventPayments, type EventPaymentKind, type EventPaymentRow } from "@/db/schema/event-payments";
import type { UserTeamRow } from "@/db/schema/user-teams";
import { getAppUrl } from "@/lib/app-url";
import { getDb } from "@/lib/db";
import { entryPricePln, type EventSummary } from "@/lib/events/types";
import { localePath } from "@/lib/i18n/config";
import { getStripe } from "@/lib/stripe";

import type { IndividualEntryPayload } from "./fulfil";

/**
 * Starting a paid entry: the Checkout Session that takes the entry fee, and the
 * `event_payments` row the webhook turns into a registration or a team entry.
 *
 * Nothing is registered here. A free night writes its registration the moment
 * the button is pressed; a paid night writes only this row, and
 * `fulfilEventPayment` writes the registration once Stripe says the money has
 * settled. So an abandoned checkout leaves no half-registered runner and no
 * entry nobody paid for.
 *
 * Entry fees are PLN, not ACER: ACER is a reward currency for now, and the ACER
 * top-up is off.
 */

/** What marks a Checkout Session as an entry fee. The webhook branches on it. */
export const EVENT_ENTRY_KIND = "event_entry";

/** How long a session stays payable. Stripe's minimum is 30 minutes. */
const SESSION_TTL_SECONDS = 30 * 60;

export type CheckoutRefusal = "payment_unavailable" | "payment_pending";

export type CheckoutResult = { ok: true; url: string } | { ok: false; reason: CheckoutRefusal };

/**
 * Stripe Checkout's UI language for one of our locales. Stripe has no
 * Ukrainian, and `"auto"` can resolve a Ukrainian browser to Russian — same
 * choice as the ACER top-up.
 */
function checkoutLocale(locale: string): Stripe.Checkout.SessionCreateParams.Locale {
  return locale === "pl" ? "pl" : "en-GB";
}

function absolute(locale: string, path: string): string {
  return `${getAppUrl()}${localePath(locale, path)}`;
}

/**
 * A payer's earlier attempt at the same entry, when there is one worth
 * reusing or waiting for.
 *
 * - A **processing** row means Stripe has already said "paid" and the webhook
 *   is writing the registration. A second checkout would charge twice.
 * - A **pending** row whose session is still open is handed back as is, so a
 *   double click or a second tab returns to the same Stripe page instead of
 *   minting a second charge.
 * - A pending row whose session is `complete` has been paid and the webhook
 *   has not arrived yet: also "wait". One that has `expired` is marked so and
 *   ignored.
 */
async function resumeExisting(
  rows: EventPaymentRow[],
): Promise<CheckoutResult | null> {
  if (rows.some((row) => row.status === "processing")) {
    return { ok: false, reason: "payment_pending" };
  }
  const stripe = getStripe();
  for (const row of rows) {
    if (row.status !== "pending") continue;
    const session = await stripe.checkout.sessions.retrieve(row.stripeSessionId);
    if (session.status === "open" && session.url) return { ok: true, url: session.url };
    if (session.status === "complete") return { ok: false, reason: "payment_pending" };
    await getDb()
      .update(eventPayments)
      .set({ status: "expired" })
      .where(and(eq(eventPayments.id, row.id), eq(eventPayments.status, "pending")));
  }
  return null;
}

async function createSession({
  kind,
  event,
  payer,
  teamId,
  amountPln,
  productName,
  payload,
  locale,
  successPath,
  cancelPath,
}: {
  kind: EventPaymentKind;
  event: EventSummary;
  payer: { id: string; email: string };
  teamId: string | null;
  amountPln: number;
  productName: string;
  payload: IndividualEntryPayload | null;
  locale: string;
  successPath: string;
  cancelPath: string;
}): Promise<CheckoutResult> {
  const paymentId = randomUUID();
  const amountMinor = amountPln * 100;

  let session: Stripe.Checkout.Session;
  try {
    session = await getStripe().checkout.sessions.create({
      mode: "payment",
      locale: checkoutLocale(locale),
      customer_email: payer.email,
      client_reference_id: payer.id,
      expires_at: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
      success_url: absolute(locale, successPath),
      cancel_url: absolute(locale, cancelPath),
      // The webhook reads `paymentId`; the rest is for whoever reads the
      // payment in the Stripe dashboard.
      metadata: {
        kind: EVENT_ENTRY_KIND,
        paymentId,
        entryKind: kind,
        eventSlug: event.slug,
        userId: payer.id,
        ...(teamId ? { teamId } : {}),
      },
      payment_intent_data: {
        description: productName,
        metadata: { kind: EVENT_ENTRY_KIND, paymentId, eventSlug: event.slug },
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "pln",
            unit_amount: amountMinor,
            product_data: { name: productName },
          },
        },
      ],
    });
  } catch (error) {
    console.error(`[event-payments] could not create a ${kind} checkout for ${event.slug}:`, error);
    return { ok: false, reason: "payment_unavailable" };
  }
  if (!session.url) return { ok: false, reason: "payment_unavailable" };

  await getDb().insert(eventPayments).values({
    id: paymentId,
    kind,
    eventSlug: event.slug,
    userId: payer.id,
    teamId,
    amountMinor,
    currency: "pln",
    stripeSessionId: session.id,
    status: "pending",
    payload,
  });

  return { ok: true, url: session.url };
}

/**
 * Checkout for one runner's individual registration. `payload` is the fully
 * validated registration-with-consent input `registerForEvent` would have
 * written on a free night.
 */
export async function startIndividualCheckout({
  event,
  payer,
  payload,
  locale,
}: {
  event: EventSummary;
  payer: { id: string; email: string };
  payload: IndividualEntryPayload;
  locale: string;
}): Promise<CheckoutResult> {
  const amountPln = entryPricePln(event, "individual");
  if (amountPln <= 0) return { ok: false, reason: "payment_unavailable" };

  const earlier = await getDb()
    .select()
    .from(eventPayments)
    .where(
      and(
        eq(eventPayments.kind, "individual"),
        eq(eventPayments.eventSlug, event.slug),
        eq(eventPayments.userId, payer.id),
        inArray(eventPayments.status, ["pending", "processing"]),
      ),
    )
    .orderBy(desc(eventPayments.createdAt));
  const resumed = await resumeExisting(earlier);
  if (resumed) return resumed;

  const registerPath = `/events/${event.slug}/register`;
  return createSession({
    kind: "individual",
    event,
    payer,
    teamId: null,
    amountPln,
    productName: `${event.name} ${event.shortDate} — entry fee`,
    payload,
    locale,
    successPath: `${registerPath}?payment=success`,
    cancelPath: `${registerPath}?payment=cancelled`,
  });
}

/**
 * Checkout for a team entry, paid once by whoever pressed Enter. The roster is
 * not frozen here: the webhook re-checks it before writing the entry, because
 * it can change while the manager is on the Stripe page.
 */
export async function startTeamEntryCheckout({
  team,
  event,
  payerUserId,
  locale,
}: {
  team: UserTeamRow;
  event: EventSummary;
  payerUserId: string;
  locale: string;
}): Promise<CheckoutResult> {
  const amountPln = entryPricePln(event, "team");
  if (amountPln <= 0) return { ok: false, reason: "payment_unavailable" };

  const db = getDb();
  const [payer] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.id, payerUserId))
    .limit(1);
  if (!payer) return { ok: false, reason: "payment_unavailable" };

  // Keyed by team, not payer: two managers (or a manager and an admin) paying
  // for the same team's entry is the double charge to avoid.
  const earlier = await db
    .select()
    .from(eventPayments)
    .where(
      and(
        eq(eventPayments.kind, "team"),
        eq(eventPayments.eventSlug, event.slug),
        eq(eventPayments.teamId, team.id),
        inArray(eventPayments.status, ["pending", "processing"]),
      ),
    )
    .orderBy(desc(eventPayments.createdAt));
  const resumed = await resumeExisting(earlier);
  if (resumed) return resumed;

  const teamPath = `/teams/${team.slug}`;
  return createSession({
    kind: "team",
    event,
    payer,
    teamId: team.id,
    amountPln,
    productName: `${event.name} ${event.shortDate} — team entry: ${team.name}`,
    payload: null,
    locale,
    successPath: `${teamPath}?payment=success#enter`,
    cancelPath: `${teamPath}?payment=cancelled#enter`,
  });
}

/**
 * Whether this runner has paid for this event and the webhook is writing the
 * registration right now. Only `processing`: a `pending` row is also what an
 * abandoned checkout looks like, and treating that as "settling" would lock
 * the runner out of the form until the session expired.
 */
export async function hasSettlingIndividualPayment(
  eventSlug: string,
  userId: string,
): Promise<boolean> {
  const rows = await getDb()
    .select({ status: eventPayments.status })
    .from(eventPayments)
    .where(
      and(
        eq(eventPayments.kind, "individual"),
        eq(eventPayments.eventSlug, eventSlug),
        eq(eventPayments.userId, userId),
        eq(eventPayments.status, "processing"),
      ),
    );
  return rows.length > 0;
}
