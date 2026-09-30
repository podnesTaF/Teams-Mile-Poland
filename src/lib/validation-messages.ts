"use client";

import { useTranslations } from "next-intl";

import { DATE_FORMAT_ERROR, MIN_PARTICIPANT_AGE_ERROR } from "@/lib/age";
import { PHONE_INVALID_ERROR, PHONE_MOBILE_ERROR, PHONE_REQUIRED_ERROR } from "@/lib/phone";

/**
 * The zod schemas speak English constants (`"First name is required"`,
 * `PHONE_INVALID_ERROR`, …) because they also run where no locale is known —
 * the Better Auth field validator, the server actions. The forms render those
 * strings to Polish and Ukrainian runners as-is, which is how "the validation
 * messages don't exist" looked from a phone in Warsaw.
 *
 * This is the one table that turns a schema message into a `common.validation`
 * key. It is keyed on the exact constant so a message the table does not know
 * falls through unchanged rather than disappearing — an untranslated sentence
 * beats a blank line under a red border.
 */
const MESSAGE_KEYS: Record<string, string> = {
  "First name is required": "required",
  "Last name is required": "required",
  "Enter a valid email": "email",
  "Select one": "selectOne",
  [DATE_FORMAT_ERROR]: "date",
  [MIN_PARTICIPANT_AGE_ERROR]: "tooYoung",
  [PHONE_REQUIRED_ERROR]: "phoneRequired",
  [PHONE_INVALID_ERROR]: "phoneInvalid",
  [PHONE_MOBILE_ERROR]: "phoneMobile",
};

/** zod's own `.max()` wording, which carries the number and is never ours. */
const TOO_LONG = /^Too big/;

/**
 * `(message) => translated message`, for the inline `.field-msg` under a field.
 * Pass a schema message (client or server side) and get the runner's language
 * back; unknown messages come back untouched.
 */
export function useValidationMessage(): (message: string | undefined) => string | undefined {
  const t = useTranslations("common.validation");
  return (message) => {
    if (!message) return undefined;
    const key = MESSAGE_KEYS[message] ?? (TOO_LONG.test(message) ? "tooLong" : undefined);
    return key ? t(key) : message;
  };
}
