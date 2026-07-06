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
 * Whether a user has filled the profile fields required to register for an
 * event. `club` is optional (free-text, may be blank); the rest are required.
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
