import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";

import { accounts, sessions, users, verifications } from "@/db/schema";
import { ResetPasswordEmail } from "@/emails/reset-password";
import { VerifyEmail } from "@/emails/verify-email";
import { db } from "@/lib/db";
import { FROM_EMAIL, resend } from "@/lib/email";

/**
 * Better Auth instance for the individual mile series (email+password + Google,
 * required email verification). Wired to the existing Drizzle/postgres-js `db`
 * via the drizzle adapter; the `schema` map is keyed by the singular model
 * names the adapter resolves (`user`/`session`/`account`/`verification`),
 * pointing at our plural hand-written tables.
 *
 * Route protection is enforced in server pages/actions via
 * `auth.api.getSession({ headers: await headers() })`, NOT in proxy.ts — this
 * custom Next 16 build uses proxy.ts for next-intl only, and its matcher
 * already excludes `/api` so the catch-all auth handler is reachable.
 */
function appUrl() {
  return (
    process.env.BETTER_AUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

/** Best-effort first name for email greetings: additionalField or `name`. */
function firstNameOf(user: { name?: string | null; firstName?: string | null }): string | undefined {
  return user.firstName?.trim() || user.name?.trim().split(/\s+/)[0] || undefined;
}

export const auth = betterAuth({
  baseURL: appUrl(),
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db!, {
    provider: "pg",
    schema: {
      user: users,
      session: sessions,
      account: accounts,
      verification: verifications,
    },
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      const firstName = firstNameOf(user);
      if (!resend) {
        console.log(`[auth] reset password for ${user.email}: ${url}`);
        return;
      }
      await resend.emails.send({
        from: FROM_EMAIL,
        to: user.email,
        subject: "Reset your password — TEAMS MILE Warsaw",
        react: ResetPasswordEmail({ url, firstName }),
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      const firstName = firstNameOf(user);
      if (!resend) {
        // Dev fallback when Resend is not configured — surfaces the link.
        console.log(`[auth] verify email for ${user.email}: ${url}`);
        return;
      }
      await resend.emails.send({
        from: FROM_EMAIL,
        to: user.email,
        subject: "Verify your email — TEAMS MILE Warsaw",
        react: VerifyEmail({ url, firstName }),
      });
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    },
  },
  user: {
    additionalFields: {
      firstName: { type: "string", required: false, input: true },
      lastName: { type: "string", required: false, input: true },
      dateOfBirth: { type: "date", required: false, input: true },
      sex: { type: ["M", "F"], required: false, input: true },
      club: { type: "string", required: false, input: true },
      phone: { type: "string", required: false, input: true },
      locale: { type: "string", required: false, input: true, defaultValue: "pl" },
    },
  },
  plugins: [nextCookies()],
});
