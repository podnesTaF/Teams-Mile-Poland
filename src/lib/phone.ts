/**
 * Lightweight phone masking. No dependency — the event audience is mostly
 * Polish (Warsaw), with some Ukrainian runners, so we default to the Polish
 * dial code and format the national part in 3-digit groups: "+48 512 345 678".
 *
 * The country code stays editable: if the user types a recognised code it is
 * kept, otherwise we assume Poland. This is a display mask only — the stored
 * value is the formatted string and is validated server-side by the schemas.
 */

export const DEFAULT_DIAL_CODE = "48"; // Poland
export const DEFAULT_PHONE_PREFIX = `+${DEFAULT_DIAL_CODE} `;

// Codes relevant to the event's audience, longest-first so e.g. "380" wins
// over a hypothetical "38" before we ever fall back to Poland.
const DIAL_CODES = ["380", "375", "370", "371", "372", "420", "421", "49", "48", "44", "1"].sort(
  (a, b) => b.length - a.length,
);

function splitDialCode(digits: string): { code: string; rest: string } {
  for (const code of DIAL_CODES) {
    if (digits.startsWith(code)) return { code, rest: digits.slice(code.length) };
  }
  // No recognised code — treat the digits as a Polish national number.
  return { code: DEFAULT_DIAL_CODE, rest: digits };
}

/**
 * Format a raw input string into a masked phone number.
 * Returns "" for empty input so the floating label/placeholder can show.
 */
export function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";

  const { code, rest } = splitDialCode(digits);
  // Cap national digits so the field can't grow unbounded (schema max is 32).
  const groups = rest.slice(0, 12).match(/.{1,3}/g) ?? [];
  return groups.length ? `+${code} ${groups.join(" ")}` : `+${code} `;
}

/** True when the value carries no national digits (only a dial-code prefix). */
export function isPhoneEmpty(value: string): boolean {
  const { rest } = splitDialCode(value.replace(/\D/g, ""));
  return rest.length === 0;
}
