import { eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";

import { accounts, users } from "@/db/schema";
import { auth } from "@/lib/auth/better-auth";
import { getDb } from "@/lib/db";

/**
 * Granting the `admin` role, shared by the admin panel's invite form
 * (`admins-actions.ts`) and the bootstrap CLI (`scripts/grant-admin.ts`) — the
 * script has to work before any admin exists, so this deliberately holds no
 * `"use server"` directive and no session lookup. Callers do their own
 * authorization.
 */

/** Where the set-password link lands (locale-relative, as the auth forms use). */
const RESET_REDIRECT = "/auth/reset-password";

export function normalizeEmail(raw: unknown): string {
  return String(raw ?? "").trim().toLowerCase();
}

/** Cheap shape check — the real validation is that the invite email arrives. */
export function looksLikeEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export type GrantAdminResult =
  | { ok: false; error: string }
  | {
      ok: true;
      /** `created` = a new account was made for this email by invitation. */
      outcome: "created" | "promoted" | "already-admin";
      email: string;
      /** Whether a set-password email was requested for this address. */
      invited: boolean;
    };

/**
 * Make `email` an admin, creating the account if it doesn't exist yet.
 *
 * A brand-new invited account is written directly (not through `signUpEmail`)
 * so no password is ever chosen on the invitee's behalf and no session is
 * created here. It is stored `emailVerified: true` because the invite itself is
 * the ownership proof: the only way into the account is the set-password link
 * sent to that inbox, and `requireEmailVerification` would otherwise block the
 * sign-in that link leads to. Better Auth creates the missing `credential`
 * account row when the reset is completed, so no account row is needed upfront.
 *
 * The set-password email is sent only when the account has no usable password
 * (a fresh invite, or a Google-only/guest account). Promoting a runner who
 * already signs in with a password must not tell them to reset it — they keep
 * the credentials they have and simply gain the admin tab.
 */
export async function grantAdmin(input: {
  email: string;
  /** Force the set-password email even if a password already exists. */
  forceInvite?: boolean;
}): Promise<GrantAdminResult> {
  const email = normalizeEmail(input.email);
  if (!looksLikeEmail(email)) return { ok: false, error: "Enter a valid email address." };

  const db = getDb();
  const [existing] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  let outcome: "created" | "promoted" | "already-admin";
  let userId: string;

  if (!existing) {
    userId = nanoid(32);
    await db.insert(users).values({
      id: userId,
      // `name` is NOT NULL; the invitee sets a real one on their profile.
      name: email.split("@")[0],
      email,
      emailVerified: true,
      role: "admin",
    });
    outcome = "created";
  } else {
    userId = existing.id;
    outcome = existing.role === "admin" ? "already-admin" : "promoted";
    if (outcome === "promoted") {
      await db
        .update(users)
        .set({ role: "admin", updatedAt: new Date() })
        .where(eq(users.id, userId));
    }
  }

  const needsPassword = outcome === "created" || !(await hasPassword(userId));
  const invited = Boolean(input.forceInvite) || needsPassword;

  if (invited) {
    // Better Auth runs `sendResetPassword` through `runInBackgroundOrAwait`, so
    // this resolves `{ status: true }` even when Resend rejects the message —
    // a dead send shows up as a `[auth]` console.error, and as a still-pending
    // row in the admins list. Don't read success into this call.
    await auth.api.requestPasswordReset({ body: { email, redirectTo: RESET_REDIRECT } });
  }

  return { ok: true, outcome, email, invited };
}

/** Whether the account can sign in with a password today. */
async function hasPassword(userId: string): Promise<boolean> {
  const [row] = await getDb()
    .select({ id: accounts.id })
    .from(accounts)
    .where(
      sql`${accounts.userId} = ${userId} and ${accounts.providerId} = 'credential' and ${accounts.password} is not null`,
    )
    .limit(1);
  return Boolean(row);
}

/**
 * Drop `email` back to a plain user. Refuses to remove the last admin — that
 * would lock everyone out of the panel and leave only the CLI as a way back in.
 */
export async function revokeAdmin(userId: string): Promise<{ ok: false; error: string } | { ok: true; email: string }> {
  const db = getDb();
  const [target] = await db
    .select({ id: users.id, email: users.email, role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!target) return { ok: false, error: "User not found." };
  if (target.role !== "admin") return { ok: false, error: "That user is not an admin." };

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(eq(users.role, "admin"));
  if (count <= 1) {
    return { ok: false, error: "This is the last admin — promote someone else first." };
  }

  await db.update(users).set({ role: "user", updatedAt: new Date() }).where(eq(users.id, userId));
  return { ok: true, email: target.email };
}
