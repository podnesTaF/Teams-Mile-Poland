import { z } from "zod";

import { phoneFieldSchema } from "@/lib/phone";

export const CONTACT_METHODS = ["whatsapp", "telegram", "viber", "call", "email"] as const;
export type ContactMethod = (typeof CONTACT_METHODS)[number];

export const contactPayloadSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(120),
  email: z.email("Enter a valid email").transform((value) => value.toLowerCase()),
  phone: phoneFieldSchema(),
  message: z.string().trim().max(2000).optional().or(z.literal("")),
  method: z.enum(CONTACT_METHODS),
  terms: z.literal(true, { error: "You must accept the terms" }),
});

export type ContactPayload = z.infer<typeof contactPayloadSchema>;

export type ContactResult =
  | { ok: true }
  | { ok: false; message: string };
