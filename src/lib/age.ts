import { z } from "zod";

/** Minimum age to register as a participant. */
export const MIN_PARTICIPANT_AGE = 16;

export const MIN_PARTICIPANT_AGE_ERROR = "You must be at least 16 years old";

/** Parse a YYYY-MM-DD string as a local calendar date (no UTC shift). */
export function parseDateOnly(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function coerceToDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return parseDateOnly(value.slice(0, 10));
  }
  return null;
}

/** Whole years between two calendar dates (birthday-aware). */
export function ageOnDate(dob: Date, asOf: Date): number {
  let age = asOf.getFullYear() - dob.getFullYear();
  const monthDiff = asOf.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && asOf.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

export function meetsMinParticipantAge(
  dob: Date | string,
  asOf: Date = new Date(),
  minAge: number = MIN_PARTICIPANT_AGE,
): boolean {
  const d = typeof dob === "string" ? parseDateOnly(dob) : dob;
  return ageOnDate(d, asOf) >= minAge;
}

/** Latest DOB (YYYY-MM-DD) allowed for a given minimum age and reference date. */
export function maxDobForMinAge(minAge: number, asOf: Date = new Date()): string {
  const y = asOf.getFullYear() - minAge;
  const m = String(asOf.getMonth() + 1).padStart(2, "0");
  const d = String(asOf.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const DATE_FORMAT_ERROR = "Enter a valid date";

/** Zod schema for an HTML date input (YYYY-MM-DD), format only. */
export function dateOfBirthFormatSchema() {
  return z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, DATE_FORMAT_ERROR)
    .refine((v) => !Number.isNaN(Date.parse(v)), DATE_FORMAT_ERROR);
}

/** Zod schema for an HTML date input (YYYY-MM-DD) with optional minimum-age check. */
export function dateOfBirthSchema(asOf: Date = new Date()) {
  return dateOfBirthFormatSchema().refine(
    (v) => meetsMinParticipantAge(v, asOf),
    MIN_PARTICIPANT_AGE_ERROR,
  );
}
