import { z } from "zod";

/**
 * Guest (passwordless) event-registration input. Collects the runner profile
 * fields inline — the account is created from this, and a set-password email
 * lets them access their profile later. Phone is intentionally omitted here
 * (kept minimal); it can be added later from the profile page.
 */
export const guestRegisterSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(200),
  firstName: z.string().trim().min(1, "First name is required").max(80),
  lastName: z.string().trim().min(1, "Last name is required").max(80),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date")
    .refine((v) => !Number.isNaN(Date.parse(v)), "Enter a valid date"),
  sex: z.enum(["M", "F"], { error: "Select one" }),
  club: z.string().trim().max(120).optional().or(z.literal("")),
});

export type GuestRegisterInput = z.infer<typeof guestRegisterSchema>;
