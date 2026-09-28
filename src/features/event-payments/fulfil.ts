import { and, eq, inArray } from "drizzle-orm";
import type Stripe from "stripe";

import { userTeams, users } from "@/db/schema";
import { eventPayments, type EventPaymentRow } from "@/db/schema/event-payments";
import { createRegistrationWithConsent } from "@/features/event-registration/data";
import { sendEventTicketEmail } from "@/features/event-registration/ticket";
import { checkTeamEntry, loadTeamEvent, writeTeamEntry } from "@/features/teams/entry-service";
import { getDb } from "@/lib/db";

/**
 * Turning a settled entry-fee session into what it paid for — the webhook half
 * of `checkout.ts`.
 *
 * Stripe delivers events **at least** once. The claim below is a conditional
 * update (`pending → processing`), so a redelivery finds nothing to claim and
 * returns; only one delivery ever writes the registration. If the write throws
 * (a lost connection, not a refusal) the claim is released and the webhook
 * answers 500, so Stripe's retry gets another go.
 *
 * A **refusal** after payment — the runner registered some other way in the
 * meantime, a team member turned out to be registered alone, the night was
 * cancelled — is not retried: it would refuse again. The row is marked
 * `failed` with the reason and logged loudly, and the fee is refunded by hand
 * from the Stripe dashboard.
 */

/** The registration-with-consent input, stored at checkout and written here. */
export type IndividualEntryPayload = Parameters<typeof createRegistrationWithConsent>[0];

export type FulfilOutcome = "fulfilled" | "failed" | "already_handled" | "unpaid" | "unknown";

type Refusal = { ok: false; reason: string };
type Written = { ok: true; registrationId?: string; teamEntryId?: string };

async function writeIndividual(payment: EventPaymentRow): Promise<Written | Refusal> {
  const payload = payment.payload as IndividualEntryPayload | null;
  if (!payload) return { ok: false, reason: "missing_payload" };

  let registration;
  try {
    registration = await createRegistrationWithConsent(payload);
  } catch (error) {
    if (error instanceof Error && /unique|duplicate/i.test(error.message)) {
      return { ok: false, reason: "duplicate" };
    }
    throw error;
  }

  const [user] = await getDb()
    .select({
      email: users.email,
      name: users.name,
      firstName: users.firstName,
      lastName: users.lastName,
      club: users.club,
    })
    .from(users)
    .where(eq(users.id, payment.userId))
    .limit(1);
  // Outside the claim on purpose, like the free path: a bounced ticket email
  // must not undo a paid registration, and the ticket can be re-sent.
  if (user) {
    try {
      await sendEventTicketEmail({ registration, user });
    } catch (error) {
      console.error(`[event-payments] ticket email for ${registration.id} failed:`, error);
    }
  }
  return { ok: true, registrationId: registration.id };
}

async function writeTeam(payment: EventPaymentRow): Promise<Written | Refusal> {
  if (!payment.teamId) return { ok: false, reason: "missing_team" };
  const [team] = await getDb()
    .select()
    .from(userTeams)
    .where(eq(userTeams.id, payment.teamId))
    .limit(1);
  if (!team) return { ok: false, reason: "team_gone" };

  const event = await loadTeamEvent(payment.eventSlug);
  if (!event) return { ok: false, reason: "notfound" };
  // Only a cancelled night refuses here. Entries closing while the manager was
  // on the Stripe page is not their fault, and they have paid.
  if (event.status === "cancelled") return { ok: false, reason: "cancelled" };

  const check = await checkTeamEntry(team, event);
  if (!check.ok) return { ok: false, reason: check.reason };

  const written = await writeTeamEntry({
    team,
    event,
    roster: check.roster,
    actorUserId: payment.userId,
    // Paid by card; no ACER leaves the treasury.
    feeMinor: 0,
  });
  if (!written.ok) return { ok: false, reason: written.reason };
  return { ok: true, teamEntryId: written.entryId };
}

/** `checkout.session.completed` / `async_payment_succeeded` for an entry fee. */
export async function fulfilEventPayment(session: Stripe.Checkout.Session): Promise<FulfilOutcome> {
  if (session.payment_status !== "paid") return "unpaid";

  const db = getDb();
  const [claimed] = await db
    .update(eventPayments)
    .set({
      status: "processing",
      paidAt: new Date(),
      stripePaymentIntentId:
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : (session.payment_intent?.id ?? null),
    })
    .where(
      and(
        eq(eventPayments.stripeSessionId, session.id),
        // `expired` too: a checkout marked expired by a stale resume can still
        // have been paid in the last second, and paid money is fulfilled.
        inArray(eventPayments.status, ["pending", "expired"]),
      ),
    )
    .returning();

  if (!claimed) {
    const [known] = await db
      .select({ id: eventPayments.id })
      .from(eventPayments)
      .where(eq(eventPayments.stripeSessionId, session.id))
      .limit(1);
    return known ? "already_handled" : "unknown";
  }

  let result: Written | Refusal;
  try {
    result = claimed.kind === "team" ? await writeTeam(claimed) : await writeIndividual(claimed);
  } catch (error) {
    await db
      .update(eventPayments)
      .set({ status: "pending" })
      .where(eq(eventPayments.id, claimed.id));
    throw error;
  }

  if (!result.ok) {
    console.error(
      `[event-payments] PAID BUT NOT FULFILLED — refund needed: payment ${claimed.id}, ` +
        `session ${session.id}, ${claimed.kind} entry for ${claimed.eventSlug}: ${result.reason}`,
    );
    await db
      .update(eventPayments)
      .set({ status: "failed", failureReason: result.reason })
      .where(eq(eventPayments.id, claimed.id));
    return "failed";
  }

  await db
    .update(eventPayments)
    .set({
      status: "fulfilled",
      registrationId: result.registrationId ?? null,
      teamEntryId: result.teamEntryId ?? null,
    })
    .where(eq(eventPayments.id, claimed.id));
  return "fulfilled";
}

/** `checkout.session.expired` / `async_payment_failed`: the payer never paid. */
export async function expireEventPayment(session: Stripe.Checkout.Session): Promise<void> {
  await getDb()
    .update(eventPayments)
    .set({ status: "expired" })
    .where(
      and(eq(eventPayments.stripeSessionId, session.id), eq(eventPayments.status, "pending")),
    );
}
