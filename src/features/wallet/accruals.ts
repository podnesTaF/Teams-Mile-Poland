import { getReferrerId } from "@/features/referral/data";

import {
  PARTICIPATION_REWARD_ACER,
  REFERRAL_REWARD_ACER,
  SIGNUP_GRANT_ACER,
  acerToMinor,
} from "./config";
import { recordWalletTransaction } from "./data";

/**
 * The automatic ACER accruals — every credit nobody presses a button for.
 *
 * Two of them ride the same fact: a registration transitioning to `checked_in`
 * (ТЗ 2.6.3.2 and 2.6.3.1).
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
 *
 * The third accrual — {@link creditSignupGrant} (ADR 0013) — is automatic in the
 * same sense but rides a different fact: an account coming into existence,
 * credited from `databaseHooks.user.create.after` in `lib/auth/better-auth.ts`.
 * It lives here because everything above applies to it unchanged — one write
 * site rather than one per caller, the ledger index rather than a guard, no
 * reversal and no backfill — and because "what mints ACER without an admin" is a
 * question worth having a single file to answer. Existing accounts were
 * deliberately **not** granted (2026-09-18): the owner asked for it on
 * registration, and paying out every account already on the books is a separate
 * decision with a separate bill.
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

/**
 * {@link SIGNUP_GRANT_ACER} to a brand-new account, once per account, forever.
 * **Never throws, and never rejects** — see below.
 *
 * The key `signup:<userId>` *is* the rule. There is no "have they been granted
 * already?" read anywhere, because a read cannot be told apart from a race: two
 * concurrent creations of the same id (a retried OAuth callback, a
 * double-submitted guest form) would both see nothing and both credit. The
 * ledger's partial unique index decides instead, and the second attempt comes
 * back `null`, which is a success (see `recordWalletTransaction`). The same key
 * is what makes the grant survive a later re-run of anything: an account is
 * created once, so it is granted once, whatever else calls this.
 *
 * `reference` is left null, which is a choice and not an omission. The
 * `eventReference` note above takes a reference to be the row's *cause* named in
 * a form the wallet screen and a query can both read — `event:<slug>` earns its
 * place because the check-in happened somewhere the owner's id does not say. A
 * grant has no such somewhere: its cause is this account existing, and that is
 * already the row's own `user_id` and its own timestamp. `signup:<userId>` in
 * the reference column would only restate the `idempotency_key` beside it, and a
 * reference that restates another column is one more thing to keep true.
 *
 * `memo` is null for the reason `eventReference` gives: a memo is stored once and
 * read in whatever language its owner reads the site in, so any sentence here
 * would be an untranslatable line on the money screen. The `signup_grant` kind is
 * labelled in all three catalogs, which is what the person actually reads.
 *
 * A zero (or negative) {@link SIGNUP_GRANT_ACER} writes **no row at all** rather
 * than a zero-amount one — the rule `createTeamRows` applies to `priceMinor`. A
 * ledger of 0.00 credits is history nobody can act on, and it would also burn the
 * one-shot key, so turning the grant back on later would credit nobody.
 */
export async function creditSignupGrant(userId: string): Promise<void> {
  const amountMinor = acerToMinor(SIGNUP_GRANT_ACER);
  if (amountMinor <= 0) return;

  // Guarded by the same wrapper as the check-in rewards, for the same reason one
  // altitude up: the fact that matters is the account, and a ledger write that
  // fails must not fail the sign-up. A person who cannot create an account
  // because the wallet hiccuped is a far worse outcome than a missing grant,
  // which an admin grants by hand from the wallet panel in ten seconds.
  await attempt(`signup grant for user ${userId}`, () =>
    recordWalletTransaction({
      userId,
      asset: "ACER",
      amountMinor,
      kind: "signup_grant",
      idempotencyKey: `signup:${userId}`,
    }),
  );
}

/**
 * Run one accrual and swallow whatever it throws, loudly.
 *
 * Every caller here credits *alongside* a write that matters more than the
 * money — a check-in at the desk, an account being created — so the tagged
 * `console.error` is the whole error handling: the miss is repairable from the
 * admin wallet panel, and the fact it rides is not repairable by asking the
 * person to come back and try their life again. `what` carries the identifiers
 * an admin needs to make the repair by hand.
 */
async function attempt(what: string, run: () => Promise<unknown>): Promise<void> {
  try {
    await run();
  } catch (error) {
    console.error(`[wallet] ${what} failed; the fact that earned it stands uncredited:`, error);
  }
}
