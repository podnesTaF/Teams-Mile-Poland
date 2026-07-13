import { z } from "zod";

import { dateOfBirthFormatSchema } from "@/lib/age";

/**
 * Guest (passwordless) event-registration input. Collects the runner profile
 * fields inline — the account is created from this, and a set-password email
 * lets them access their profile later. Phone is intentionally omitted here
 * (kept minimal); it can be added later from the profile page.
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
});

export type GuestRegisterInput = z.infer<typeof guestRegisterSchema>;
