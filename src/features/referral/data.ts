import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { nanoid } from "nanoid";

import { eventRegistrations, legacyParticipations, users } from "@/db/schema";
import { getAppUrl } from "@/lib/app-url";
import { getDb } from "@/lib/db";
import { RACES_RUN_OVER_JOIN } from "@/lib/events/participation";
import { localePath } from "@/lib/i18n/config";

/**
 * Referral program (stats-only). A user shares `/r/<code>`; the route drops the
 * code in a cookie, and when a new account is created the Better Auth
 * `user.create.after` hook resolves it into `users.referred_by` — once, never
 * rewritten. Everything else (race registrations, participation) is derived by
 * joining `event_registrations` through `referred_by`, so there is no separate
 * tracking table to keep consistent.
 */

export const REF_COOKIE = "ref";
export const REF_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 90;

const CODE_LENGTH = 8;

export function makeReferralUrl(code: string, locale: string): string {
  return `${getAppUrl()}${localePath(locale, `/r/${encodeURIComponent(code)}`)}`;
}

/**
 * The user's shareable code, generated on first request. The conditional
 * `WHERE referral_code IS NULL` update keeps a concurrent request from
 * overwriting an already-issued code; a unique-index collision on the random
 * candidate just retries with a fresh one.
 */
export async function getOrCreateReferralCode(userId: string): Promise<string> {
  const db = getDb();
  for (let attempt = 0; attempt < 3; attempt++) {
    const [row] = await db
      .select({ code: users.referralCode })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!row) throw new Error(`getOrCreateReferralCode: no user ${userId}`);
    if (row.code) return row.code;
    try {
      const [updated] = await db
        .update(users)
        .set({ referralCode: nanoid(CODE_LENGTH) })
        .where(and(eq(users.id, userId), isNull(users.referralCode)))
        .returning({ code: users.referralCode });
      if (updated?.code) return updated.code;
    } catch {
      // Unique collision on the candidate — loop and draw another.
    }
  }
  throw new Error("getOrCreateReferralCode: could not allocate a code");
}

/** The user a referral code belongs to, or null for an unknown code. */
export async function findReferrerByCode(code: string): Promise<{ id: string } | null> {
  const trimmed = code.trim();
  if (!trimmed) return null;
  const db = getDb();
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.referralCode, trimmed))
    .limit(1);
  return row ?? null;
}

/**
 * Record who referred a freshly created account. First writer wins
 * (`WHERE referred_by IS NULL`); unknown codes and self-referrals are ignored.
 * Never throws — a broken referral cookie must not fail a sign-up.
 */
export async function applyReferralAttribution(
  userId: string,
  code: string | null | undefined,
): Promise<void> {
  if (!code) return;
  try {
    const referrer = await findReferrerByCode(code);
    if (!referrer || referrer.id === userId) return;
    await getDb()
      .update(users)
      .set({ referredBy: referrer.id })
      .where(and(eq(users.id, userId), isNull(users.referredBy)));
  } catch (error) {
    console.error(`[referral] attribution for user ${userId} failed:`, error);
  }
}

/**
 * Who referred this account, or null when nobody did.
 *
 * `users.referred_by` is this feature's column — attribution writes it here and
 * the admin drill-downs read it through `referrals-data.ts`. The wallet's
 * check-in accrual (`src/features/wallet/accruals.ts`) needs the same answer to
 * know who to pay, and asks for it here rather than reaching into the column
 * itself.
 */
export async function getReferrerId(userId: string): Promise<string | null> {
  const [row] = await getDb()
    .select({ referredBy: users.referredBy })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row?.referredBy ?? null;
}

export type ReferralStats = {
  /** Accounts created through the user's link. */
  signups: number;
  /** Race registrations by those accounts (any non-cancelled status). */
  raceRegistrations: number;
  /**
   * Races those accounts actually ran, per the one canonical definition
   * (`src/lib/events/participation.ts`): checked in on site, plus legacy
   * attendance — rare for a referred account, but the definition is the same one
   * the profile stat and the admin users list report.
   */
  participations: number;
};

export async function getReferralStats(userId: string): Promise<ReferralStats> {
  const db = getDb();
  const [row] = await db
    .select({
      signups: sql<number>`count(distinct ${users.id})`.mapWith(Number),
      // `distinct` throughout: the two left joins below are independently
      // one-to-many per referred account and so multiply each other's rows.
      raceRegistrations: sql<number>`count(distinct ${eventRegistrations.id})`.mapWith(Number),
      // `::int` inside the expression, so no `mapWith` — see the helper.
      participations: RACES_RUN_OVER_JOIN,
    })
    .from(users)
    .leftJoin(
      eventRegistrations,
      and(eq(eventRegistrations.userId, users.id), ne(eventRegistrations.status, "cancelled")),
    )
    .leftJoin(legacyParticipations, eq(legacyParticipations.userId, users.id))
    .where(eq(users.referredBy, userId));
  return row ?? { signups: 0, raceRegistrations: 0, participations: 0 };
}
