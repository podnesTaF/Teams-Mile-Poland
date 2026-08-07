import { z } from "zod";

import { phoneFieldSchema } from "@/lib/phone";

export const FLOW_IDS = ["start", "join", "free"] as const;
export type RegistrationFlow = (typeof FLOW_IDS)[number];

/* ────────────────────────────────────────────────────────
 * Person — the new lightweight runner capture.
 *
 * The whole runner identity is now { fullName, email, phone, terms }.
 * Everything we used to ask for (dob, gender, nationality, age category,
 * club, coach, personal best, regional/teammate preferences, the five
 * separate consent checkboxes) is gone — collected separately later if
 * we ever need it.
 * ──────────────────────────────────────────────────────── */
export const personSchema = z.object({
  fullName: z.string().trim().min(2, "Full name is required").max(120),
  email: z.email("Enter a valid email").transform((value) => value.toLowerCase()),
  phone: phoneFieldSchema(),
});

export const termsSchema = z.literal(true, { error: "You must accept the terms" });

// UI locale the runner registered in — drives lifecycle email language.
// Injected server-side from the request locale; defaults to "ua".
export const localeSchema = z.enum(["ua", "pl", "en"]).default("ua");

export const startTeamSchema = z.object({
  flow: z.literal("start"),
  teamName: z.string().trim().min(2, "Team name is required").max(80),
  teamSize: z.coerce.number().int().min(7, "At least 7 runners").max(12, "At most 12 runners"),
  person: personSchema,
  terms: termsSchema,
  locale: localeSchema,
});

export const freeRunnerSchema = z.object({
  flow: z.literal("free"),
  person: personSchema,
  terms: termsSchema,
  locale: localeSchema,
});

export const joinTeamSchema = z.object({
  flow: z.literal("join"),
  teamCode: z.string().trim().min(3, "Team code is required").max(40),
  person: personSchema,
  terms: termsSchema,
  locale: localeSchema,
});

export const registrationPayloadSchema = z.discriminatedUnion("flow", [
  startTeamSchema,
  joinTeamSchema,
  freeRunnerSchema,
]);

export type Person = z.infer<typeof personSchema>;
export type StartTeamPayload = z.infer<typeof startTeamSchema>;
export type FreeRunnerPayload = z.infer<typeof freeRunnerSchema>;
export type JoinTeamPayload = z.infer<typeof joinTeamSchema>;
export type RegistrationPayload = z.infer<typeof registrationPayloadSchema>;
// Input shape the client modals submit — `locale` is optional here and is
// stamped server-side (see submitRegistration), so callers needn't pass it.
export type RegistrationInput = z.input<typeof registrationPayloadSchema>;

export type RegistrationResult =
  | {
      ok: true;
      status: "free";
      flow: RegistrationFlow;
      runnerEmail: string;
      teamCode?: string;
      inviteUrl?: string;
    }
  | { ok: true; status: "paid"; redirectTo: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

export const defaultPerson: Person = {
  fullName: "",
  email: "",
  phone: "",
};

export function normalizeTeamCode(value: string) {
  return value.trim().toUpperCase();
}
