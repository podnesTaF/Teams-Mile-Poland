import { and, eq } from "drizzle-orm";

import { emailLog } from "@/db/schema";
import { getDb } from "@/lib/db";
import { resend, FROM_EMAIL } from "@/lib/email";
import { EVENT } from "@/lib/marketing/event";
import { makeInviteUrl } from "@/features/registration/data";
import { makeTicketUrl } from "@/features/ticket";
import { googleCalendarUrl } from "@/lib/calendar";
import { LifecycleEmail, type LifecycleUrls } from "@/emails/lifecycle";
import { lifecycleContent, type LifecycleKind } from "@/emails/lifecycle/copy";

import { dueKinds } from "./schedule";
import { eligibleForKind, type Recipient } from "./audience";

export type KindSummary = {
  kind: LifecycleKind;
  eligible: number;
  sent: number;
  skipped: number;
  failed: number;
};

/** Runner ids that already received a given lifecycle email (success only). */
async function sentRunnerIds(kind: LifecycleKind): Promise<Set<string>> {
  const rows = await getDb()
    .select({ runnerId: emailLog.runnerId })
    .from(emailLog)
    .where(and(eq(emailLog.kind, kind), eq(emailLog.status, "sent")));
  return new Set(rows.map((r) => r.runnerId));
}

function urlsFor(r: Recipient): LifecycleUrls {
  return {
    calendar: googleCalendarUrl(),
    ticket: makeTicketUrl(r.id, { locale: r.locale }),
    map: EVENT.mapsUrl,
    invite: r.teamCode ? makeInviteUrl(r.teamCode) : undefined,
  };
}

/**
 * Send one lifecycle email to every eligible runner who hasn't received it.
 * Only successful sends are logged (via the unique `(runner_id, kind)` index),
 * so failures are naturally retried on the next run.
 */
export async function sendKind(kind: LifecycleKind): Promise<KindSummary> {
  const recipients = await eligibleForKind(kind);
  const summary: KindSummary = { kind, eligible: recipients.length, sent: 0, skipped: 0, failed: 0 };

  // No mail provider configured (dev / preview) — no-op, report as skipped.
  if (!resend) {
    summary.skipped = recipients.length;
    return summary;
  }

  const already = await sentRunnerIds(kind);
  const db = getDb();

  for (const r of recipients) {
    if (already.has(r.id)) {
      summary.skipped += 1;
      continue;
    }
    const ctx = { fullName: r.fullName, teamName: r.teamName, remaining: r.remaining };
    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: r.email,
        subject: lifecycleContent(kind, r.locale, ctx).title,
        react: LifecycleEmail({ kind, locale: r.locale, ctx, urls: urlsFor(r) }),
      });
      await db.insert(emailLog).values({ runnerId: r.id, kind, status: "sent" }).onConflictDoNothing();
      summary.sent += 1;
    } catch {
      summary.failed += 1;
    }
  }

  return summary;
}

/** Run every lifecycle email currently due at `now`. */
export async function runDueMailings(now: Date): Promise<KindSummary[]> {
  const summaries: KindSummary[] = [];
  for (const kind of dueKinds(now)) {
    summaries.push(await sendKind(kind));
  }
  return summaries;
}
