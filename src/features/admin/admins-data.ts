import { asc, eq, inArray, sql } from "drizzle-orm";

import { accounts, users } from "@/db/schema";
import { ADMIN_ROLES, type AdminRole } from "@/lib/auth/roles";
import { getDb } from "@/lib/db";

export type AdminRow = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  /** Access level: full / check-in / view-only (see `src/lib/auth/roles.ts`). */
  role: AdminRole;
  /**
   * Whether a `credential` account row with a password exists. `false` means
   * the invite is still outstanding — the person cannot sign in until they use
   * the set-password link, so the list offers to (re-)send it.
   */
  hasPassword: boolean;
  createdAt: Date;
};

/**
 * Every account holding any admin role, oldest first (so the bootstrap admin
 * stays at the top). `hasPassword` is what distinguishes a working admin from a
 * pending invite; Better Auth stores the hash on the `credential` account row,
 * and a Google-only or guest-created account legitimately has none.
 */
export async function listAdmins(): Promise<AdminRow[]> {
  const db = getDb();

  const credential = db
    .select({ userId: accounts.userId })
    .from(accounts)
    .where(sql`${accounts.providerId} = 'credential' and ${accounts.password} is not null`)
    .as("credential");

  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      emailVerified: users.emailVerified,
      role: sql<AdminRole>`${users.role}`,
      hasPassword: sql<boolean>`${credential.userId} is not null`,
      createdAt: users.createdAt,
    })
    .from(users)
    .leftJoin(credential, eq(credential.userId, users.id))
    .where(inArray(users.role, [...ADMIN_ROLES]))
    .orderBy(asc(users.createdAt));
}

/** How many accounts currently hold the `admin` role. */
export async function countAdmins(): Promise<number> {
  const [row] = await getDb()
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(eq(users.role, "admin"));
  return row?.count ?? 0;
}
