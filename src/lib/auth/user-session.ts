import { headers } from "next/headers";

import { auth } from "./better-auth";

/**
 * Server-side session access for RSC pages and server actions. Route protection
 * is enforced here (not in proxy.ts) — this custom Next 16 build uses proxy.ts
 * for next-intl only. `headers()` is async on this build.
 */

export type SessionUser = NonNullable<
  Awaited<ReturnType<typeof auth.api.getSession>>
>["user"];

/** The signed-in user, or null. */
export async function getUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
}

/**
 * The signed-in user, or `null` when unauthenticated. Callers decide where to
 * redirect (locale-aware) so this stays free of routing concerns.
 */
export async function requireUser(): Promise<SessionUser | null> {
  return getUser();
}

/**
 * Whether the account holds the `admin` role — the single gate on `/admin`,
 * the admin API routes, and the admin-only bits of the ticket page. `role`
 * rides on the session user as a Better Auth additionalField declared
 * `input: false`, so it reflects the `users.role` column and cannot be set by
 * any client payload.
 */
export function isAdmin(user: SessionUser | null | undefined): boolean {
  if (!user) return false;
  return (user as SessionUser & { role?: string | null }).role === "admin";
}

/** The signed-in user when they are an admin, else `null`. */
export async function getAdminUser(): Promise<SessionUser | null> {
  const user = await getUser();
  return isAdmin(user) ? user : null;
}

/**
 * Whether a user has filled the full profile (including phone). Drives the
 * profile-page "complete your profile" badge and the event register gate
 * ({@link canRegister}).
 */
export function isProfileComplete(user: SessionUser | null | undefined): boolean {
  if (!user) return false;
  const u = user as SessionUser & {
    firstName?: string | null;
    lastName?: string | null;
    dateOfBirth?: unknown;
    sex?: string | null;
    phone?: string | null;
  };
  return Boolean(
    u.firstName?.trim() &&
      u.lastName?.trim() &&
      u.dateOfBirth &&
      u.sex &&
      u.phone?.trim(),
  );
}

/**
 * Whether a user has the profile fields required to register for an event:
 * `firstName, lastName, dateOfBirth, sex, phone` (`club` stays optional).
 * Phone became required at registration with the ADR-0002 amendment
 * (2026-08), so this now matches {@link isProfileComplete}. Kept as its own
 * name so call sites keep reading as the register gate.
 */
export function canRegister(user: SessionUser | null | undefined): boolean {
  return isProfileComplete(user);
}
