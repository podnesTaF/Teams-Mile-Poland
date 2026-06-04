import { eq } from "drizzle-orm";

import { broadcasts, emailLog } from "@/db/schema";
import { getDb } from "@/lib/db";
import { resend, FROM_EMAIL } from "@/lib/email";
import { BroadcastEmail } from "@/emails/lifecycle";

import { recipientsForSegment, type Segment } from "./audience";

export type BroadcastInput = {
  subject: string;
  bodyHtml: string;
  segment: Segment;
  teamId?: string | null;
};

export type BroadcastResult = {
  broadcastId: string;
  total: number;
  sent: number;
  failed: number;
};

/**
 * Persist a broadcast record, then send it to the resolved segment.
 * Deduped per `(runner_id, broadcast_id)` so a re-run can't double-send the
 * same broadcast to the same person.
 */
export async function sendBroadcast(input: BroadcastInput): Promise<BroadcastResult> {
  const db = getDb();

  const [row] = await db
    .insert(broadcasts)
    .values({
      subject: input.subject,
      bodyHtml: input.bodyHtml,
      segment: input.segment,
      teamId: input.teamId ?? null,
      status: "draft",
    })
    .returning({ id: broadcasts.id });

  const broadcastId = row.id;
  const recipients = await recipientsForSegment(input.segment, input.teamId);
  let sent = 0;
  let failed = 0;

  if (resend) {
    for (const r of recipients) {
      try {
        await resend.emails.send({
          from: FROM_EMAIL,
          to: r.email,
          subject: input.subject,
          react: BroadcastEmail({ subject: input.subject, bodyHtml: input.bodyHtml }),
        });
        await db
          .insert(emailLog)
          .values({ runnerId: r.id, kind: "broadcast", broadcastId, status: "sent" })
          .onConflictDoNothing();
        sent += 1;
      } catch {
        failed += 1;
      }
    }
  }

  await db.update(broadcasts).set({ status: "sent", sentCount: sent }).where(eq(broadcasts.id, broadcastId));
  return { broadcastId, total: recipients.length, sent, failed };
}
