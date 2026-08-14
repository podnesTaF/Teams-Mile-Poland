import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import type { ReactElement } from "react";

import { accounts, sessions, users, verifications } from "@/db/schema";
import { ResetPasswordEmail } from "@/emails/reset-password";
import { VerifyEmail } from "@/emails/verify-email";
import { applyReferralAttribution, REF_COOKIE } from "@/features/referral/data";
import { getAppUrl, vercelDeploymentOrigins } from "@/lib/app-url";
import { db } from "@/lib/db";
import { FROM_EMAIL, getResend, resend } from "@/lib/email";
import { phoneFieldSchema } from "@/lib/phone";

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
 *
 * `baseURL` must be the public custom domain (`NEXT_PUBLIC_APP_URL`), not the
 * Vercel deployment host — verification/reset emails embed this origin.
 */

/** Best-effort first name for email greetings: additionalField or `name`. */
function firstNameOf(user: { name?: string | null; firstName?: string | null }): string | undefined {
  return user.firstName?.trim() || user.name?.trim().split(/\s+/)[0] || undefined;
}

/**
 * Send an auth email and fail loudly.
 *
 * Resend reports API-level rejections (unverified sending domain, bad `from`,
 * rate limit) in the resolved `{ error }` rather than by throwing, so a bare
 * `await resend.emails.send(...)` swallows them: `/request-password-reset`
 * still answers `{ status: true }` and the flow looks healthy while no mail
 * ever leaves. Better Auth runs these senders through
 * `runInBackgroundOrAwait`, which catches and logs whatever we throw — the
 * response stays 200 either way, so the tagged `console.error` below is what
 * makes a dead send findable in the deploy logs.
 */
async function sendAuthEmail(input: {
  kind: "reset-password" | "verify-email";
  to: string;
  subject: string;
  react: ReactElement;
}): Promise<void> {
  const { error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to: input.to,
    subject: input.subject,
    react: input.react,
  });
  if (error) {
    console.error(`[auth] ${input.kind} email to ${input.to} rejected by Resend:`, error);
    throw new Error(`Resend rejected the ${input.kind} email: ${error.message}`);
  }
}

export const auth = betterAuth({
  baseURL: getAppUrl(),
  // getAppUrl() is the custom domain, so it is the only default trusted
  // origin — add this deployment's Vercel hosts so sign-in still works when
  // the app is reached at a preview or `*.vercel.app` URL.
  trustedOrigins: [getAppUrl(), ...vercelDeploymentOrigins()],
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
      await sendAuthEmail({
        kind: "reset-password",
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
      await sendAuthEmail({
        kind: "verify-email",
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
      // Without this, a Google sign-up stores only `name` and the runner
      // immediately hits the profile-completeness wall with empty name fields
      // even though the ID token carries them.
      mapProfileToUser: (profile) => ({
        firstName: profile.given_name,
        lastName: profile.family_name,
      }),
    },
  },
  account: {
    /**
     * Let "Continue with Google" attach to an existing local account with the
     * same email instead of dead-ending on `account_not_linked`. This app
     * manufactures *unverified* local accounts routinely (guest event
     * registration, every email sign-up before the verify click), so the
     * default `requireLocalEmailVerified: true` rejected exactly those people.
     * Google asserts email ownership (`email_verified`), which is the same
     * guarantee our own verification link provides; on link Better Auth marks
     * the local email verified. Accepted edge: a password set on a never-
     * verified account stays valid after the owner links via Google — guest
     * accounts carry unusable random passwords, so this is theoretical here.
     * NOTE: `requireLocalEmailVerified` is deprecated upstream (the gate is
     * slated to become unconditional) — re-check this flow on Better Auth
     * upgrades.
     */
    accountLinking: {
      enabled: true,
      trustedProviders: ["google"],
      requireLocalEmailVerified: false,
    },
  },
  databaseHooks: {
    user: {
      create: {
        // Referral attribution: every account-creation path funnels through
        // here (email sign-up, Google OAuth callback, and `registerAsGuest`,
        // which forwards the browser headers for this reason). The `ref`
        // cookie is set by `/r/[code]`; the helper ignores unknown codes and
        // never throws.
        after: async (user, ctx) => {
          const code = ctx?.getCookie(REF_COOKIE);
          if (code) await applyReferralAttribution(user.id, code);
        },
      },
    },
  },
  user: {
    additionalFields: {
      // `input: false` keeps this off every client-writable payload (sign-up,
      // update-user) while still returning it on the session user — that is
      // what makes `session.user.role` a safe admin gate.
      role: { type: "string", required: false, input: false, defaultValue: "user" },
      firstName: { type: "string", required: false, input: true },
      lastName: { type: "string", required: false, input: true },
      dateOfBirth: { type: "date", required: false, input: true },
      sex: { type: ["M", "F"], required: false, input: true },
      club: { type: "string", required: false, input: true },
      // Sign-up posts straight to Better Auth, bypassing the form schemas, so
      // the phone rule has to be attached here too. Better Auth only runs the
      // validator when the field is present, so Google sign-up (which sends no
      // phone) is unaffected.
      phone: {
        type: "string",
        required: false,
        input: true,
        validator: { input: phoneFieldSchema() },
      },
      locale: { type: "string", required: false, input: true, defaultValue: "pl" },
    },
  },
  plugins: [nextCookies()],
});
