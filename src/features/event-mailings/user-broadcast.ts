import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { userBroadcastLog, userBroadcasts } from "@/db/schema";
import { BroadcastEmail } from "@/emails/lifecycle";
import { getDb } from "@/lib/db";
import { FROM_EMAIL, resend } from "@/lib/email";

import { unsubscribeFooter } from "./unsubscribe";
import { parseUserSegment, resolveUserSegment, type UserSegment } from "./user-segments";

export type UserBroadcastRow = typeof userBroadcasts.$inferSelect;

export type UserBroadcastResult = {
  broadcastId: string;
  total: number;
  sent: number;
  skipped: number;
  failed: number;
};

/** User ids that already have a log row for this broadcast (the dedup guard). */
async function alreadyLogged(broadcastId: string, userIds: string[]): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  const rows = await getDb()
    .select({ id: userBroadcastLog.userId })
    .from(userBroadcastLog)
    .where(
      and(
        eq(userBroadcastLog.broadcastId, broadcastId),
        inArray(userBroadcastLog.userId, userIds),
      ),
    );
  return new Set(rows.map((r) => r.id));
}

/**
 * Resolve the broadcast's segment and email each consenting recipient, deduped
 * per `(user, broadcast)`: anyone already logged for this broadcast is skipped
 * before sending, so a re-send double-emails nobody. Only successful sends are
 * logged (conflict-ignore), so a failed send retries cleanly on the next run.
 * Failures are counted, never fatal — the batch always finishes.
 */
async function deliver(broadcast: {
  id: string;
  subject: string;
  bodyHtml: string;
  segment: UserSegment;
}): Promise<UserBroadcastResult> {
  const db = getDb();
  const recipients = await resolveUserSegment(broadcast.segment);
  const result: UserBroadcastResult = {
    broadcastId: broadcast.id,
    total: recipients.length,
    sent: 0,
    skipped: 0,
    failed: 0,
  };

  if (!resend) {
    result.skipped = recipients.length;
    return result;
  }

  const done = await alreadyLogged(
    broadcast.id,
    recipients.map((r) => r.userId),
  );

  for (const r of recipients) {
    if (done.has(r.userId)) {
      result.skipped += 1;
      continue;
    }
    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: r.email,
        subject: broadcast.subject,
        react: BroadcastEmail({
          subject: broadcast.subject,
          bodyHtml: broadcast.bodyHtml,
          unsubscribe: unsubscribeFooter(r.userId, r.locale),
        }),
      });
      await db
        .insert(userBroadcastLog)
        .values({ userId: r.userId, broadcastId: broadcast.id, status: "sent" })
        .onConflictDoNothing();
      result.sent += 1;
    } catch {
      result.failed += 1;
    }
  }

  // sent_count reflects the cumulative distinct deliveries (log rows), so a
  // re-send that reaches nobody new leaves the recorded count unchanged.
  const [{ value: logged }] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(userBroadcastLog)
    .where(eq(userBroadcastLog.broadcastId, broadcast.id));
  await db
    .update(userBroadcasts)
    .set({ status: "sent", sentCount: logged })
    .where(eq(userBroadcasts.id, broadcast.id));

  return result;
}

/**
 * Persist a new broadcast, then send it to its resolved segment. The PRD's
 * `sendUserBroadcast(subject, bodyHtml, segment)` contract entry.
 */
export async function sendUserBroadcast(
  subject: string,
  bodyHtml: string,
  segment: UserSegment,
): Promise<UserBroadcastResult> {
  const [row] = await getDb()
    .insert(userBroadcasts)
    .values({ subject, bodyHtml, segment, status: "draft" })
    .returning({ id: userBroadcasts.id });
  return deliver({ id: row.id, subject, bodyHtml, segment });
}

/**
 * Re-send an existing broadcast against its stored segment. Idempotent by the
 * per-(user, broadcast) dedup: recipients already reached are skipped, so this
 * only ever fills gaps (e.g. a partial first send) and never double-emails.
 */
/**
 * Why a re-send did not happen. Two distinct causes that used to share one
 * `null`: the broadcast is gone, versus the broadcast is here but the audience
 * it named can no longer be identified (its event was cancelled, deleted, or is
 * unreadable). An admin debugging silent mail needs to be told which.
 */
export type ResendRefusal = { refused: "notfound" | "unresolvable_segment" };

export async function resendUserBroadcast(
  broadcastId: string,
): Promise<UserBroadcastResult | ResendRefusal> {
  const [row] = await getDb()
    .select()
    .from(userBroadcasts)
    .where(eq(userBroadcasts.id, broadcastId))
    .limit(1);
  if (!row) return { refused: "notfound" };
  // Re-validate rather than cast. The stored string was valid when it was
  // written, but a per-event segment names an event, and events are rows now —
  // the event it targets may since have been cancelled, deleted, or simply be
  // unreadable. `parseUserSegment` returns null for all three, and re-sending
  // to an audience we can no longer identify is how a one-night mail becomes a
  // mail to everybody.
  const segment = await parseUserSegment(row.segment);
  if (!segment) return { refused: "unresolvable_segment" };
  return deliver({
    id: row.id,
    subject: row.subject,
    bodyHtml: row.bodyHtml,
    segment,
  });
}

/** Recent user broadcasts for the admin history table, newest first. */
export async function listUserBroadcasts(limit = 20): Promise<UserBroadcastRow[]> {
  return getDb()
    .select()
    .from(userBroadcasts)
    .orderBy(desc(userBroadcasts.createdAt))
    .limit(limit);
}
