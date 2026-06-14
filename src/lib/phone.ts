import { PARSE_DIAL_CODES } from "@/lib/country-calling-codes";

/**
 * Phone formatting helpers for the registration/contact forms.
 * The stored value is a display string like "+48 512 345 678" (validated
 * server-side by zod schemas).
 */

export const DEFAULT_DIAL_CODE = "48"; // Poland
export const DEFAULT_COUNTRY_ISO = "PL";
export const DEFAULT_PHONE_PREFIX = `+${DEFAULT_DIAL_CODE} `;

export type ParsedPhone = {
  dialCode: string;
  national: string;
};

function splitDialCode(digits: string): ParsedPhone {
  for (const code of PARSE_DIAL_CODES) {
    if (digits.startsWith(code)) {
      return { dialCode: code, national: digits.slice(code.length) };
    }
  }
  return { dialCode: DEFAULT_DIAL_CODE, national: digits };
}

/** Split a stored/display phone string into dial code + national digits. */
export function parsePhone(value: string): ParsedPhone {
  const digits = value.replace(/\D/g, "");
  if (!digits) return { dialCode: DEFAULT_DIAL_CODE, national: "" };
  return splitDialCode(digits);
}

/** Group national digits in threes for the input mask. */
export function formatNationalDigits(digits: string): string {
  const clean = digits.replace(/\D/g, "").slice(0, 12);
  const groups = clean.match(/.{1,3}/g) ?? [];
  return groups.join(" ");
}

/** Build the stored phone string from dial code + raw national digits. */
export function buildPhone(dialCode: string, nationalDigits: string): string {
  const national = nationalDigits.replace(/\D/g, "").slice(0, 12);
  if (!national) return "";
  const groups = national.match(/.{1,3}/g) ?? [];
  return `+${dialCode} ${groups.join(" ")}`;
}

/**
 * Format free-form input (legacy single-field path).
 * Returns "" for empty input so the floating label/placeholder can show.
 */
export function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";

  const { dialCode, national } = splitDialCode(digits);
  return buildPhone(dialCode, national) || `+${dialCode} `;
}

/** True when the value carries no national digits (only a dial-code prefix). */
export function isPhoneEmpty(value: string): boolean {
  return parsePhone(value).national.length === 0;
}
