import { Resend } from "resend";

export const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export function getResend() {
  if (!resend) {
    throw new Error("RESEND_API_KEY is not set");
  }

  return resend;
}

export const FROM_EMAIL = process.env.EMAIL_FROM ?? "TEAMS MILE Warsaw <no-reply@example.com>";
