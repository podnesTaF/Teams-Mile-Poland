import { z } from "zod";

import { dateOfBirthFormatSchema } from "@/lib/age";
import { phoneFieldSchema } from "@/lib/phone";

/**
 * Guest (passwordless) event-registration input. Collects the runner profile
 * fields inline — the account is created from this, and a set-password email
 * lets them access their profile later. Phone is required (ADR-0002
 * amendment), mirroring the profile schema.
 *
 * Minimum age is re-checked server-side against the event date.
 */
export const guestRegisterSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(200),
  firstName: z.string().trim().min(1, "First name is required").max(80),
  lastName: z.string().trim().min(1, "Last name is required").max(80),
  dateOfBirth: dateOfBirthFormatSchema(),
  sex: z.enum(["M", "F"], { error: "Select one" }),
  club: z.string().trim().max(120).optional().or(z.literal("")),
  phone: phoneFieldSchema(),
});

export type GuestRegisterInput = z.infer<typeof guestRegisterSchema>;

/**
 * The consent form at the confirm step (ADR 0006).
 *
 * This schema checks the *shape* only — which ids are required, and whether the
 * image question is answered rather than ticked, is decided against the manifest
 * by `validateConsentItems` in `src/lib/legal/consent.ts`, because the answer
 * depends on the event's document set and must not be duplicated here.
 *
 * `locale` is the language the documents were **actually shown in**, sent by the
 * client for exactly that reason: a runner whose profile says `pl` but who read
 * the English page accepted the English text, and the stored evidence has to say
 * so.
 *
 * `emergencyContact` is required and `address` is not — the Statement prints
 * both, but only the first is a fact the organiser needs on race night.
 */
export const consentSubmissionSchema = z.object({
  docSet: z.enum(["individual", "team"]),
  locale: z.enum(["pl", "en", "ua"]),
  items: z.record(z.string(), z.union([z.literal(true), z.enum(["agree", "disagree"])])),
  emergencyContact: z.string().trim().min(1, "Emergency contact is required").max(200),
  address: z.string().trim().max(300).optional().or(z.literal("")),
});

export type ConsentSubmissionInput = z.infer<typeof consentSubmissionSchema>;
