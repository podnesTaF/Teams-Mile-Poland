import { getReferrerId } from "@/features/referral/data";

import { PARTICIPATION_REWARD_ACER, REFERRAL_REWARD_ACER, acerToMinor } from "./config";
import { recordWalletTransaction } from "./data";

/**
 * The automatic ACER accruals, both of which ride the same fact: a registration
 * transitioning to `checked_in` (ТЗ 2.6.3.2 and 2.6.3.1).
 *
 * 1. The **runner** earns {@link PARTICIPATION_REWARD_ACER} for turning up —
 *    every event, every time.
 * 2. Their **referrer**, if they have one, earns {@link REFERRAL_REWARD_ACER}
 *    the first time this person is checked in *anywhere* — once per referred
 *    person, forever, no matter how many nights they later race. A sign-up on
 *    its own pays nothing, which is what makes referral farming worthless
 *    without physical attendance.
 *
 * Both are plain data-layer writes and not server actions, as PRD #44's frozen
 * Contracts specify ("Accruals (data-layer, not actions) — invoked inside the
 * existing check-in transition"). Concretely they hang off the two UPDATEs in
 * `src/features/admin/events-data.ts` that every check-in funnels through —
 * `checkInWithBib` (an explicit bib, a bib already held from the heat builder, a
 * freshly leased one) and `checkInWithoutBib` (bib-pending on an exhausted
 * pool). That is a deliberate choice of site over the action layer: the desk has
 * four ways to mark a runner present but only two writes, so crediting at the
 * write makes "exactly one reward per check-in" true by construction instead of
 * by four callers remembering. The corollary is worth knowing before adding a
 * fifth path: **anything that calls those two functions mints ACER.** A write
 * that leases a bib without transitioning the status (`leaseBibForCheckedIn` —
 * the waiting list) deliberately does not, because the runner was already
 * present and already paid.
 *
 * Idempotency is the ledger's partial unique index on `idempotency_key`, so a
 * ticket re-scan, a desk retry, or re-assigning a bib to someone already
 * present writes nothing new — see `recordWalletTransaction`.
 *
 * Two things this deliberately does **not** do:
 *
 * - **Reverse anything.** Undoing a check-in or marking a no-show afterwards
 *   (`revertToRegistered`, `markNoShow`) leaves the credit standing, and the
 *   participation key then blocks a re-credit if they are checked in again. The
 *   ledger is append-only: a reward that should not have been paid is corrected
 *   by an admin `reversal` row, not by deleting the accrual.
 * - **Backfill.** Earning starts here; check-ins and referrals from before this
 *   shipped earn nothing (client decision, 2026-08-20).
 */

export type CheckInAccrualInput = {
  registrationId: string;
  /** The runner who was marked present. */
  userId: string;
  eventSlug: string;
};

/**
 * Both rows are stamped `event:<slug>` — the accrual's cause is a check-in at a
 * named race night, and the referrer's row wants it as much as the runner's
 * (their reward exists because their invitee raced *there*). The referred
 * person's own id is not lost by that choice: it is the referral row's
 * `idempotency_key`, which is a queryable column, not just a guard.
 *
 * Nothing is written to `memo`. A memo is stored once and read by whoever opens
 * the wallet, in whatever language they read the site in, so any sentence put
 * there would be an untranslatable string on the money screen — and the row
 * already says everything it needs to: the `kind` label is translated in all
 * three catalogs (#45) and the row's own timestamp *is* the race night, because
 * a check-in happens at the event. `memo` stays reserved for the admin panel's
 * mandatory reason, where a human chose the words.
 */
function eventReference(eventSlug: string): string {
  return `event:${eventSlug}`;
}

/** 1 ACER to the runner for this check-in. Keyed by the registration. */
async function creditParticipation({
  registrationId,
  userId,
  eventSlug,
}: CheckInAccrualInput): Promise<void> {
  await recordWalletTransaction({
    userId,
    asset: "ACER",
    amountMinor: acerToMinor(PARTICIPATION_REWARD_ACER),
    kind: "participation_reward",
    reference: eventReference(eventSlug),
    idempotencyKey: `participation:${registrationId}`,
  });
}

/**
 * 1 ACER to whoever referred this runner, keyed by the **referred person** and
 * not by the registration — that key is the whole per-person-once rule: their
 * second event finds the row already there and writes nothing.
 *
 * `users.referred_by` (read through the referral feature, which owns it) is the
 * only linkage; a runner nobody referred simply produces no row. A row where
 * that column somehow points at the runner themselves is skipped rather than
 * paid: attribution refuses self-referrals on the way in
 * (`applyReferralAttribution`), and if one ever existed anyway it would turn one
 * check-in into two credits for the same person.
 */
async function creditReferrer({ userId, eventSlug }: CheckInAccrualInput): Promise<void> {
  const referrerId = await getReferrerId(userId);
  if (!referrerId || referrerId === userId) return;

  await recordWalletTransaction({
    userId: referrerId,
    asset: "ACER",
    amountMinor: acerToMinor(REFERRAL_REWARD_ACER),
    kind: "referral_signup",
    reference: eventReference(eventSlug),
    idempotencyKey: `referral_checkin:${userId}`,
  });
}

/**
 * Credit both rewards for one check-in. **Never throws, and never rejects.**
 *
 * A runner is standing at the desk with a queue behind them: a wallet write
 * that fails must not fail their check-in, because the check-in is the fact
 * that matters and the miss is repairable afterwards from the admin wallet
 * panel. The two accruals are also independent facts, so each is guarded on its
 * own — a failed participation credit must not cost the referrer theirs.
 */
export async function awardCheckInRewards(input: CheckInAccrualInput): Promise<void> {
  await Promise.all([
    attempt(`participation reward for registration ${input.registrationId}`, () =>
      creditParticipation(input),
    ),
    attempt(`referral reward for check-in of user ${input.userId}`, () => creditReferrer(input)),
  ]);
}

async function attempt(what: string, run: () => Promise<void>): Promise<void> {
  try {
    await run();
  } catch (error) {
    console.error(`[wallet] ${what} failed; check-in stands uncredited:`, error);
  }
}
