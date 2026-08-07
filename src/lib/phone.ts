import examples from "libphonenumber-js/examples.mobile.json";
import {
  type CountryCode,
  formatIncompletePhoneNumber,
  getExampleNumber,
  parsePhoneNumberFromString,
  validatePhoneNumberLength,
} from "libphonenumber-js/max";
import { z } from "zod";

import { PARSE_DIAL_CODES, countryByDial, countryByIso } from "@/lib/country-calling-codes";

/**
 * Phone parsing, masking and validation for the registration/contact forms.
 *
 * The stored value stays a display string like "+48 512 345 678" — grouped by
 * libphonenumber's per-country rules, so it round-trips through `parsePhone`
 * and renders as-is in tickets and emails.
 *
 * Metadata: `/max` (not the default `/min`). `/min` only checks number *length*,
 * so "+48 999 999 999" would pass; `/max` carries the per-country digit
 * patterns and rejects it, and is the only set that can tell a mobile from a
 * landline. One set is imported here and used by BOTH the client mask and the
 * server schema on purpose — a client/server split would let a form submit a
 * number the action then rejects.
 */

export const DEFAULT_DIAL_CODE = "48"; // Poland
export const DEFAULT_COUNTRY_ISO = "PL";

/**
 * Require a mobile number and reject confirmed landlines. Runners are texted
 * their heat assignment, so a landline is a dead end. Flip to `false` to accept
 * any valid number — `phoneIssue` stops reporting "landline" and nothing else
 * changes.
 */
export const REQUIRE_MOBILE = true;

/** E.164 caps a full number (country code included) at 15 digits. */
const E164_MAX_DIGITS = 15;

/** libphonenumber number types that can receive a text. */
const MOBILE_TYPES = new Set(["MOBILE", "FIXED_LINE_OR_MOBILE"]);

/** Characters a written phone number may contain — everything else is junk. */
const PHONE_CHARS = /^[+\d\s().\-/]*$/;

export const PHONE_REQUIRED_ERROR = "Phone is required";
export const PHONE_INVALID_ERROR = "Enter a valid phone number for the selected country";
export const PHONE_MOBILE_ERROR = "Enter a mobile number — we text you your heat assignment";

export type ParsedPhone = {
  dialCode: string;
  national: string;
};

/** Why a phone value is unacceptable, or `null` when it is fine. */
export type PhoneIssue = "empty" | "invalid" | "landline" | null;

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function splitDialCode(digits: string): ParsedPhone {
  for (const code of PARSE_DIAL_CODES) {
    if (digits.startsWith(code)) {
      return { dialCode: code, national: digits.slice(code.length) };
    }
  }
  return { dialCode: DEFAULT_DIAL_CODE, national: digits };
}

/**
 * Split a stored/display phone string into dial code + national digits.
 *
 * Deliberately does not go through libphonenumber's parser: this runs on every
 * keystroke against half-typed values ("+48 51"), which `parsePhoneNumber`
 * rejects outright. Longest-dial-code-first matching handles partials.
 */
export function parsePhone(value: string): ParsedPhone {
  const digits = onlyDigits(value);
  if (!digits) return { dialCode: DEFAULT_DIAL_CODE, national: "" };
  return splitDialCode(digits);
}

function isoForDialCode(dialCode: string): string {
  return countryByDial(dialCode)?.iso ?? DEFAULT_COUNTRY_ISO;
}

function dialForIso(iso: string): string {
  return countryByIso(iso)?.dial ?? DEFAULT_DIAL_CODE;
}

/**
 * Trim national digits to the most the selected country can hold, so the mask
 * stops accepting input rather than building a number that can never validate.
 * Countries libphonenumber doesn't know (e.g. PN) fall back to the E.164 cap.
 */
export function capNationalDigits(digits: string, iso: string): string {
  const dial = dialForIso(iso);
  let out = onlyDigits(digits).slice(0, Math.max(1, E164_MAX_DIGITS - dial.length));
  while (out.length > 1 && validatePhoneNumberLength(out, iso as CountryCode) === "TOO_LONG") {
    out = out.slice(0, -1);
  }
  return out;
}

/**
 * Group national digits the way the selected country writes them — "512 345 678"
 * for PL, "7400 123456" for GB, "67 123 4567" for UA.
 *
 * Formats the international form and strips the dial code back off: the
 * national-only formatter expects a trunk prefix (GB's leading 0) that this
 * field never holds, and returns the digits unformatted without it.
 */
export function formatNationalDigits(digits: string, iso: string = DEFAULT_COUNTRY_ISO): string {
  const capped = capNationalDigits(digits, iso);
  if (!capped) return "";

  const dial = dialForIso(iso);
  const prefix = `+${dial}`;
  const international = formatIncompletePhoneNumber(`${prefix}${capped}`);
  return international.startsWith(prefix) ? international.slice(prefix.length).trimStart() : capped;
}

/**
 * A sample national number for the country, grouped like the mask will group it
 * — used as the field placeholder so the expected shape is visible before
 * typing. "" for the few countries with no example in the metadata (e.g. PN).
 */
export function examplePhoneForCountry(iso: string): string {
  const example = getExampleNumber(iso as CountryCode, examples);
  return example ? formatNationalDigits(example.nationalNumber, iso) : "";
}

/** Build the stored phone string from a country + raw national digits. */
export function buildPhone(iso: string, nationalDigits: string): string {
  const national = formatNationalDigits(nationalDigits, iso);
  if (!national) return "";
  return `+${dialForIso(iso)} ${national}`;
}

/** True when the value carries no national digits (only a dial-code prefix). */
export function isPhoneEmpty(value: string): boolean {
  return parsePhone(value).national.length === 0;
}

/**
 * Classify a phone value. Callers pick the message so the client can translate
 * it while the zod schemas stay on the English constants above.
 */
export function phoneIssue(value: string): PhoneIssue {
  const trimmed = value.trim();
  if (!trimmed) return "empty";
  // Anything holding characters a phone number can't contain is a wrong answer,
  // not a missing one — it earns the "invalid" message rather than "required".
  if (!PHONE_CHARS.test(trimmed)) return "invalid";
  // Past this point only punctuation and digits remain, so "empty" is reserved
  // for what the mask itself can leave behind: "", "+", or a bare dial code.
  if (!onlyDigits(trimmed)) return "empty";

  // Stored values always carry a dial code; a bare national number would
  // otherwise be parsed against no country at all.
  const { dialCode, national } = parsePhone(trimmed);
  if (!national) return "empty";
  const parsed = parsePhoneNumberFromString(`+${dialCode}${national}`);
  if (!parsed?.isValid()) return "invalid";
  if (REQUIRE_MOBILE) {
    const type = parsed.getType();
    // An unknown type means the metadata carries no pattern for it — accept it
    // rather than reject a number that already passed `isValid()`.
    if (type && !MOBILE_TYPES.has(type)) return "landline";
  }
  return null;
}

/** True when the value is a phone number we will accept. */
export function isValidPhone(value: string): boolean {
  return phoneIssue(value) === null;
}

/**
 * Canonical display form for storage. Returns "" when the value is unusable, so
 * callers never persist a half-typed number.
 */
export function normalizePhone(value: string): string {
  const { dialCode, national } = parsePhone(value);
  if (!national) return "";
  return buildPhone(isoForDialCode(dialCode), national);
}

/**
 * Zod schema for a phone field: rejects anything libphonenumber can't confirm
 * as a real (mobile) number and normalizes the accepted value for storage.
 *
 * Only runs where a value is present — the four form schemas all require a
 * phone, and Better Auth skips the validator for absent fields (OAuth sign-up
 * sends none).
 */
export function phoneFieldSchema() {
  return z
    .string()
    .trim()
    .superRefine((value, ctx) => {
      const issue = phoneIssue(value);
      if (!issue) return;
      ctx.addIssue({
        code: "custom",
        message:
          issue === "empty"
            ? PHONE_REQUIRED_ERROR
            : issue === "landline"
              ? PHONE_MOBILE_ERROR
              : PHONE_INVALID_ERROR,
      });
    })
    .transform((value) => normalizePhone(value) || value);
}
