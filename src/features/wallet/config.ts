/**
 * Wallet economics in one place.
 *
 * ACER is **prepaid platform credit** pegged 1 ACER = 1 USD — never a token, a
 * stablecoin or crypto in anything user- or Stripe-facing. The reward amounts
 * live here rather than in a table so changing what a check-in is worth is a
 * deploy, not a migration.
 *
 * The pack list and the custom-amount bounds are declared here by the PRD's
 * frozen Contracts even though nothing reads them yet: the purchase slice's
 * server action and its form must both read one set of numbers, and a bound
 * that lives in the form is a bound the server does not enforce.
 */

/** Minor units per whole ACER. Money is integer minor units everywhere. */
export const ACER_MINOR_UNITS = 100;

/**
 * Credited to the runner on each on-site check-in (per event, every event).
 *
 * Raised from 1 on 2026-09-18 (ADR 0013) together with the entry fees it pays
 * for. Past participations were topped **up to** this number by
 * `scripts/backfill-participation-rewards.ts` — everyone who has run a race
 * holds exactly this much for it, whenever they ran — so raising it again means
 * deciding whether to top up again, not just editing the constant.
 */
export const PARTICIPATION_REWARD_ACER = 5;

/**
 * Credited once to every account when it is created (ADR 0013), from the
 * `user.create.after` database hook — so email sign-up, Google OAuth and the
 * guest registration flow are all covered by one write.
 *
 * It exists to make the guest funnel finishable: a first-timer who signs up
 * through `registerAsGuest` must be able to pay the individual entry fee of the
 * night they came for. **Keep this at or above the highest priced night's
 * `individual_entry_fee_acer`** or that person reaches the consent screen and
 * is refused for want of money they were never told they needed. It is not a
 * compile-time assertion, because the fee is a column and this is a constant;
 * `scripts/verify-entry-fees.ts` checks it against every priced row instead.
 */
export const SIGNUP_GRANT_ACER = 5;

/** Credited to the referrer the first time a person they referred checks in — once per person. */
export const REFERRAL_REWARD_ACER = 1;

/**
 * What founding a team costs, in whole ACER, debited from the creator's wallet
 * in the same transaction that creates the team (`createTeam`). Entering an
 * event as a team is priced per night on the event row
 * (`events.team_entry_fee_acer`, ADR 0013), not here. Changing this is a
 * deploy, not a migration; a
 * value of 0 skips the debit entirely rather than writing zero-amount rows.
 *
 * 0 since 2026-09-25 (ADR 0015): founding a team is free. ACER is a reward
 * currency for now, and entry fees are paid in PLN by card. The four teams
 * founded at 100 ACER before this keep that debit — the owner's call.
 */
export const TEAM_CREATION_PRICE_ACER = 0;

/** Preset top-up amounts, in whole ACER (= whole USD). */
export const ACER_PACKS: readonly number[] = [10, 25, 50, 100];

/** Bounds on the custom top-up amount, in whole ACER. Enforced server-side, not just in the form. */
export const ACER_CUSTOM_MIN = 5;
export const ACER_CUSTOM_MAX = 500;

/**
 * Whether an amount may be bought.
 *
 * Whole ACER, between {@link ACER_CUSTOM_MIN} and {@link ACER_CUSTOM_MAX}. The
 * preset packs are a subset of that range, so there is one rule rather than a
 * pack list and a bound that can drift apart. A fraction is refused rather than
 * rounded: "0.5 ACER" is a typo far more often than an intention.
 *
 * It lives here, beside the bounds and away from anything server-only, so the
 * purchase form and the server action can call the *same* function — the form's
 * `min`/`max`/`step` are a courtesy to the person typing, and this is the rule
 * either way.
 */
export function isValidAcerAmount(amount: number): boolean {
  return Number.isInteger(amount) && amount >= ACER_CUSTOM_MIN && amount <= ACER_CUSTOM_MAX;
}

/** Whole (or fractional) ACER → signed integer minor units. */
export function acerToMinor(acer: number): number {
  return Math.round(acer * ACER_MINOR_UNITS);
}

/** Signed integer minor units → ACER as a number (2 decimals of precision). */
export function minorToAcer(amountMinor: number): number {
  return amountMinor / ACER_MINOR_UNITS;
}

/**
 * Bounds on one treasury movement — a member's contribution or the manager's
 * payout — in whole ACER (ADR 0012). The floor keeps the ledger free of
 * zero-amount rows; the ceiling is a typo guard, not a policy, sized well above
 * anything a team has a reason to move in one press. Enforced by the action;
 * the forms carry it as `min`/`max` so the field refuses what the server would.
 */
export const TREASURY_TRANSFER_MIN_ACER = 1;
export const TREASURY_TRANSFER_MAX_ACER = 10_000;

/** Whole ACER within the treasury bounds. Fractions are refused, not rounded, like {@link isValidAcerAmount}. */
export function isValidTreasuryAmount(amount: number): boolean {
  return (
    Number.isInteger(amount) &&
    amount >= TREASURY_TRANSFER_MIN_ACER &&
    amount <= TREASURY_TRANSFER_MAX_ACER
  );
}
