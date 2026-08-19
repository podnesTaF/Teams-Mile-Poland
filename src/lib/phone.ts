import {
  type CountryCode,
  formatIncompletePhoneNumber as formatIncomplete,
  getExampleNumber as getExample,
  parsePhoneNumberFromString as parseNumber,
  validatePhoneNumberLength as validateLength,
} from "libphonenumber-js/core";
import examples from "libphonenumber-js/examples.mobile.json";
import metadata from "libphonenumber-js/metadata.max.json";
import { z } from "zod";

import { PARSE_DIAL_CODES, countryByDial, countryByIso } from "@/lib/country-calling-codes";

/**
 * Phone parsing, masking and validation for the registration/contact forms.
 *
 * The stored value stays a display string like "+48 512 345 678" — grouped by
 * libphonenumber's per-country rules, so it round-trips through `parsePhone`
 * and renders as-is in tickets and emails.
 *
 * Metadata: `metadata.max.json` (not `min`). `min` only checks number *length*,
 * so "+48 999 999 999" would pass; `max` carries the per-country digit patterns
 * and rejects it, and is the only set that can tell a mobile from a landline.
 * One set is imported here and used by BOTH the client mask and the server
 * schema on purpose — a client/server split would let a form submit a number the
 * action then rejects.
 *
 * The metadata is imported explicitly and threaded through `libphonenumber-js/
 * core`, rather than taken implicitly from the `libphonenumber-js/max` wrapper
 * this module used to call. `/max` loads its metadata with
 * `require('../metadata.max.json')` — a relative *file path* — and tsx's CJS
 * loader hands relative JSON requires back wrapped as `{ default: … }`, so under
 * `npx tsx` every `/max` call throws "`metadata` argument was passed but it's
 * not a valid metadata". That made this whole module untestable and unusable
 * from `scripts/`, which is where the phone backfill has to run. Bare package
 * specifiers like the import above are unaffected.
 *
 * Keep to ONE import style. The bare specifier resolves through the package
 * export map to `metadata.max.json.js`, while `/max` reaches the raw
 * `metadata.max.json`: two module identities for the same 158KB of data, and
 * mixing them invites the bundler to ship both to the browser. The client bundle
 * currently carries exactly one copy — verify that still holds
 * (`grep -ro "country_calling_codes:{" .next/static/chunks | wc -l` → 1) if you
 * ever change how the metadata is imported. `scripts/`-side equivalence of the
 * two forms was checked function-by-function across ~700 inputs when this was
 * rewired; they agree everywhere.
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
  while (out.length > 1 && validateLength(out, iso as CountryCode, metadata) === "TOO_LONG") {
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
  const international = formatIncomplete(`${prefix}${capped}`, metadata);
  return international.startsWith(prefix) ? international.slice(prefix.length).trimStart() : capped;
}

/**
 * A sample national number for the country, grouped like the mask will group it
 * — used as the field placeholder so the expected shape is visible before
 * typing. "" for the few countries with no example in the metadata (e.g. PN).
 */
export function examplePhoneForCountry(iso: string): string {
  const example = getExample(iso as CountryCode, examples, metadata);
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
  const parsed = parseNumber(`+${dialCode}${national}`, metadata);
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
 * Canonical E.164 key for a phone value — "+48512345678", digits only after the
 * plus. This is the *dedup* form, stored alongside the display form in
 * `users.phone_e164`; `normalizePhone` above remains what tickets and emails
 * render. Returns `null` for anything libphonenumber cannot confirm as a real
 * number, so the column never holds a key that two different people could share
 * by accident.
 *
 * A value already carrying "+" is parsed as written; anything else is read
 * against `DEFAULT_COUNTRY_ISO` (PL), which is what a bare "512345678" from a
 * legacy import means. A bare "48512345678" still lands on +48512345678 —
 * libphonenumber prefers the country-code reading over an over-long PL national
 * number. Deliberately NOT routed through `parsePhone`: its longest-prefix
 * dial-code split is built for half-typed input and would read "512345678" as
 * Peru (+51) rather than as Polish digits.
 *
 * Gated on `isValid()` against the same metadata `phoneIssue` uses, rather than
 * `isPossible()`: a key derived from a number the metadata rejects is not a key
 * worth matching on. Loosen it here if a duplicates report ever needs to reach
 * further — `scripts/backfill-phone-e164.ts` prints every row this leaves null,
 * so the cost of the strict bar stays visible.
 */
export function toE164(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (!PHONE_CHARS.test(trimmed)) return null;

  const parsed = trimmed.startsWith("+")
    ? parseNumber(trimmed, metadata)
    : parseNumber(trimmed, DEFAULT_COUNTRY_ISO as CountryCode, metadata);
  if (!parsed?.isValid()) return null;
  return parsed.number;
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
