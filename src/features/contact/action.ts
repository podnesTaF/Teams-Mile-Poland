"use server";

import { contactInquiries } from "@/db/schema";
import { getDb } from "@/lib/db";
import { EVENT } from "@/lib/marketing/event";
import { FROM_EMAIL, resend } from "@/lib/email";

import { contactPayloadSchema, type ContactPayload, type ContactResult } from "./schema";

const INBOX_EMAIL = process.env.CONTACT_INBOX_EMAIL ?? EVENT.contact.email;

export async function submitContact(payload: ContactPayload): Promise<ContactResult> {
  const parsed = contactPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please check the form fields and try again.",
    };
  }

  const { name, email, phone, message, method } = parsed.data;

  // Persist every inquiry so it can be managed in /admin. This is the
  // source of truth — email below is a best-effort notification on top.
  let stored = false;
  if (process.env.DATABASE_URL) {
    try {
      await getDb().insert(contactInquiries).values({
        name,
        email,
        phone,
        message: message ? message : null,
        method,
      });
      stored = true;
    } catch {
      stored = false;
    }
  }

  // Best-effort email notification (only when Resend is configured).
  if (resend) {
    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: INBOX_EMAIL,
        replyTo: email,
        subject: `Contact form — ${name}`,
        text:
          `Name: ${name}\n` +
          `Email: ${email}\n` +
          `Phone: ${phone}\n` +
          `Preferred method: ${method}\n\n` +
          `${message ?? ""}`,
      });
    } catch {
      // If it was stored, the inquiry is safe in the DB; ignore email failure.
      if (!stored) {
        return { ok: false, message: "Could not send your message. Please try again." };
      }
    }
  }

  // Nothing persisted and nothing emailed → tell the user instead of silently dropping.
  if (!stored && !resend) {
    return {
      ok: false,
      message: "Messaging is not configured yet. Please reach us directly.",
    };
  }

  return { ok: true };
}
