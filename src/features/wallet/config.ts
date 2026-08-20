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

/** Whole (or fractional) ACER → signed integer minor units. */
export function acerToMinor(acer: number): number {
  return Math.round(acer * ACER_MINOR_UNITS);
}

/** Signed integer minor units → ACER as a number (2 decimals of precision). */
export function minorToAcer(amountMinor: number): number {
  return amountMinor / ACER_MINOR_UNITS;
}
