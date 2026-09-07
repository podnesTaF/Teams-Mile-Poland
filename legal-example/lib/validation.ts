import { z } from "zod";
import type { DocumentContent } from "@/content/types";

/**
 * Buduje schemat walidacji Zod na podstawie configu dokumentu
 * (content/i18n/*.ts). Dzięki temu formularz (klient) i /api/consent
 * (serwer) korzystają z DOKŁADNIE tej samej logiki wymagalności pól —
 * nie da się przypadkowo rozjechać walidacji front/back.
 */
export function buildConsentSchema(doc: DocumentContent) {
  const fieldsShape: Record<string, z.ZodTypeAny> = {};
  for (const field of doc.fields) {
    fieldsShape[field.name] = field.required
      ? z.string().trim().min(1, "required")
      : z.string().trim().optional().default("");
  }

  const checkboxesShape: Record<string, z.ZodTypeAny> = {};
  for (const cb of doc.checkboxes) {
    checkboxesShape[cb.id] = cb.required
      ? z.literal(true, {
          errorMap: () => ({ message: "required" }),
        })
      : z.boolean().optional().default(false);
  }

  const base = {
    eventId: z.string().trim().min(1, "required"),
    locale: z.enum(["pl", "en", "ua", "ru"]),
    docSlug: z.string().trim().min(1),
    fields: z.object(fieldsShape),
    checkboxes: z.object(checkboxesShape),
  };

  if (doc.imageConsent) {
    return z.object({
      ...base,
      imageConsent: z.enum(["agree", "disagree"], {
        errorMap: () => ({ message: "required" }),
      }),
    });
  }

  return z.object({
    ...base,
    imageConsent: z.enum(["agree", "disagree"]).optional(),
  });
}

export type ConsentPayload = {
  eventId: string;
  locale: string;
  docSlug: string;
  fields: Record<string, string>;
  checkboxes: Record<string, boolean>;
  imageConsent?: "agree" | "disagree";
};
