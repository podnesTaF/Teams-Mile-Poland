import { minorToAcer } from "./config";

/** BCP-47 tag per app locale, as every other formatter in the app maps them. */
const TAG: Record<string, string> = { en: "en-GB", pl: "pl-PL", ua: "uk-UA" };

function tag(locale: string): string {
  return TAG[locale] ?? TAG.en;
}

/**
 * A balance as the wallet shows it — two decimals, grouped in the reader's
 * language ("1 234,50" in pl/ua, "1,234.50" in en). No explicit `+`: a balance
 * is a standing amount, not a movement. A negative balance (an admin debit
 * larger than what was earned) still renders with its minus, which is the
 * honest thing to show.
 */
export function formatWalletBalance(amountMinor: number, locale: string): string {
  return new Intl.NumberFormat(tag(locale), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minorToAcer(amountMinor));
}

/**
 * A ledger amount as the history shows it — **signed**, because the direction
 * of the movement is the point (ТЗ 2.6.4.2). `+` is shown explicitly; zero
 * carries no sign.
 */
export function formatWalletAmount(amountMinor: number, locale: string): string {
  return new Intl.NumberFormat(tag(locale), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: "exceptZero",
  }).format(minorToAcer(amountMinor));
}

/**
 * A transaction's timestamp, pinned to Europe/Warsaw like every other date in
 * the app — the runner matching a credit against the race night it came from
 * should see race-night local time, not their travel timezone.
 */
export function formatWalletDateTime(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(tag(locale), {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Warsaw",
  }).format(date);
}

/**
 * A top-up price as the payer will be charged it: always USD, because that is
 * the only currency the checkout runs in (1 ACER = $1, no conversion). Rendered
 * in the reader's number format, so a Polish visitor sees "25,00 USD" — their
 * grouping, our currency, no pretending the charge is in złoty.
 */
export function formatPurchasePrice(amountAcer: number, locale: string): string {
  return new Intl.NumberFormat(tag(locale), {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountAcer);
}
