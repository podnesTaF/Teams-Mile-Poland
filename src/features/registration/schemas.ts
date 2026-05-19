import { z } from "zod";

export const FLOW_IDS = ["start", "join", "free", "solo"] as const;
export type RegistrationFlow = (typeof FLOW_IDS)[number];

export const REGIONS = [
  "Mazowieckie (Warsaw)",
  "Malopolskie (Krakow)",
  "Pomorskie (Gdansk)",
  "Wielkopolskie (Poznan)",
  "Dolnoslaskie (Wroclaw)",
  "Other / national",
] as const;

export const NATIONALITIES = [
  "Poland",
  "Germany",
  "Czechia",
  "Lithuania",
  "Ukraine",
  "United Kingdom",
  "Other",
] as const;

export const teamInfoSchema = z.object({
  name: z.string().trim().min(2, "Team name is required").max(80),
  category: z.enum(["mens", "womens", "mixed"], {
    error: "Choose a team category",
  }),
  region: z.string().trim().min(2, "Region is required").max(80),
});

export const runnerInfoSchema = z.object({
  firstName: z.string().trim().min(2, "First name is required").max(60),
  lastName: z.string().trim().min(2, "Last name is required").max(60),
  email: z.email("Enter a valid email").transform((value) => value.toLowerCase()),
  phone: z.string().trim().min(6, "Phone is required").max(32),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a date of birth"),
  gender: z.enum(["male", "female"], { error: "Choose a gender" }),
  nationality: z.string().trim().min(2, "Nationality is required").max(80),
  club: z.string().trim().max(80).optional().or(z.literal("")),
  coach: z.string().trim().max(80).optional().or(z.literal("")),
  personalBest: z.string().trim().max(12).optional().or(z.literal("")),
});

export const preferencesSchema = z.object({
  ageCategory: z.string().trim().min(2, "Choose an age category"),
  preferredRegion: z.string().trim().max(80).optional().or(z.literal("")),
  preferredTeammates: z.string().trim().max(500).optional().or(z.literal("")),
});

export const soloOptionalSchema = z.object({
  ageCategory: z.string().trim().min(2, "Choose an age category"),
});

export const consentsSchema = z.object({
  medical: z.literal(true, { error: "Medical declaration is required" }),
  gdpr: z.literal(true, { error: "GDPR consent is required" }),
  rules: z.literal(true, { error: "Rules acceptance is required" }),
  image: z.literal(true, { error: "Image consent is required" }),
  liability: z.literal(true, { error: "Liability waiver is required" }),
});

export const startTeamSchema = z.object({
  flow: z.literal("start"),
  team: teamInfoSchema,
  runner: runnerInfoSchema,
  consents: consentsSchema,
});

export const joinTeamSchema = z.object({
  flow: z.literal("join"),
  teamCode: z.string().trim().min(3, "Team code is required").max(40),
  runner: runnerInfoSchema.extend({
    ageCategory: z.string().trim().min(2, "Choose an age category"),
  }),
  consents: consentsSchema,
});

export const freeRunnerSchema = z.object({
  flow: z.literal("free"),
  runner: runnerInfoSchema,
  preferences: preferencesSchema,
  consents: consentsSchema,
});

export const soloRunnerSchema = z.object({
  flow: z.literal("solo"),
  runner: runnerInfoSchema,
  solo: soloOptionalSchema,
  consents: consentsSchema,
});

export const registrationPayloadSchema = z.discriminatedUnion("flow", [
  startTeamSchema,
  joinTeamSchema,
  freeRunnerSchema,
  soloRunnerSchema,
]);

export type StartTeamPayload = z.infer<typeof startTeamSchema>;
export type JoinTeamPayload = z.infer<typeof joinTeamSchema>;
export type FreeRunnerPayload = z.infer<typeof freeRunnerSchema>;
export type SoloRunnerPayload = z.infer<typeof soloRunnerSchema>;
export type RegistrationPayload = z.infer<typeof registrationPayloadSchema>;

export type RegistrationResult =
  | { ok: true; status: "free"; redirectTo: string }
  | { ok: true; status: "paid"; redirectTo: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

export const defaultRunner = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  dob: "",
  gender: undefined,
  nationality: "Poland",
  club: "",
  coach: "",
  personalBest: "",
} as const;

export const defaultConsents = {
  medical: false,
  gdpr: false,
  rules: false,
  image: false,
  liability: false,
} as const;

export function parsePersonalBestSeconds(value?: string | null) {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const parts = trimmed.split(":").map(Number);
  if (parts.length === 2 && parts.every(Number.isFinite)) {
    return parts[0] * 60 + parts[1];
  }

  const numeric = Number(trimmed);
  return Number.isFinite(numeric) ? numeric : null;
}

export function normalizeTeamCode(value: string) {
  return value.trim().toUpperCase();
}
