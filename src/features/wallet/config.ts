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

/** Credited to the runner on each on-site check-in (per event, every event). */
export const PARTICIPATION_REWARD_ACER = 1;

/** Credited to the referrer the first time a person they referred checks in — once per person. */
export const REFERRAL_REWARD_ACER = 1;

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
