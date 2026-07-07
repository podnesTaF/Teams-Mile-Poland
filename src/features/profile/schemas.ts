import { z } from "zod";

import { dateOfBirthFormatSchema } from "@/lib/age";

/** Profile fields for individual-event registration. `club` is optional. */
export const profileSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(80),
  lastName: z.string().trim().min(1, "Last name is required").max(80),
  // HTML date input value, YYYY-MM-DD. Format only — the minimum-age rule is
  // enforced at registration against the *event* date (registerForEvent /
  // registerAsGuest), not here against "now", so a runner who turns 16 before
  // race day can still save their profile.
  dateOfBirth: dateOfBirthFormatSchema(),
  sex: z.enum(["M", "F"], { error: "Select one" }),
  club: z.string().trim().max(120).optional().or(z.literal("")),
  phone: z.string().trim().min(6, "Phone is required").max(32),
});

export type ProfileInput = z.infer<typeof profileSchema>;

export type ProfileResult =
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };
