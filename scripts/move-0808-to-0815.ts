/**
 * One-time participant move: `mile-2026-08-08` → `mile-2026-08-15`.
 *
 * The 08-08 race night was cancelled. Every entry on it is re-slugged to the
 * 08-15 morning, which takes over as the open night in the registry. Runners are
 * contacted personally, so this sends **no mail** — it imports nothing from
 * `@/lib/email` or the mailings feature, and touches no `event_email_log` row.
 *
 * Attendance confirmations carry over as-is (owner's call): a runner who had
 * confirmed for the 8th arrives on the 15th already `confirmed`, with their
 * original `confirmedAt` intact.
 *
 * Dry-run by default — prints the plan and writes nothing. Pass `--write`.
 *
 *   npx tsx --env-file=.env.local scripts/move-0808-to-0815.ts
 *   npx tsx --env-file=.env.local scripts/move-0808-to-0815.ts --write
 *
 * Refuses to write unless every precondition below holds, because each one
 * would otherwise carry event-specific state onto a different night:
 * - no registration on 08-08 holds a bib (a bib is a lease on *that* night's
 *   pool — ADR 0003), is assigned to a heat, has been notified of a heat time,
 *   or has been checked in / marked no-show;
 * - no heat exists on either event (heats are keyed by event_slug; a moved
 *   runner's `heat_id` would point at a cancelled night's heat);
 * - no user is registered on both events (the `(event_slug, user_id)` unique
 *   index would reject the update).
 *
 * Idempotent: a second run finds 0 rows on 08-08 and reports nothing to do.
 */
import { eq, inArray } from "drizzle-orm";

import { eventHeats, eventRegistrations, users } from "../src/db/schema";
import { getDb } from "../src/lib/db";

const FROM = "mile-2026-08-08";
const TO = "mile-2026-08-15";
const WRITE = process.argv.includes("--write");

async function main() {
  const db = getDb();

  const regs = await db
    .select()
    .from(eventRegistrations)
    .where(inArray(eventRegistrations.eventSlug, [FROM, TO]));
  const from = regs.filter((r) => r.eventSlug === FROM);
  const to = regs.filter((r) => r.eventSlug === TO);

  if (from.length === 0) {
    console.log(`nothing to move — ${FROM} has 0 registrations (${TO} has ${to.length})`);
    return;
  }

  const heats = await db
    .select({ id: eventHeats.id, eventSlug: eventHeats.eventSlug, number: eventHeats.number })
    .from(eventHeats)
    .where(inArray(eventHeats.eventSlug, [FROM, TO]));

  const onTo = new Set(to.map((r) => r.userId));
  const problems: string[] = [];
  for (const h of heats) problems.push(`heat #${h.number} exists on ${h.eventSlug}`);
  for (const r of from) {
    const who = r.userId;
    if (r.bib !== null) problems.push(`${who} holds bib ${r.bib}`);
    if (r.heatId) problems.push(`${who} is assigned to a heat`);
    if (r.notifiedHeatId || r.notifiedHeatTime) problems.push(`${who} was notified of a heat time`);
    if (r.checkedInAt) problems.push(`${who} is checked in`);
    if (r.status === "checked_in" || r.status === "no_show") {
      problems.push(`${who} has on-site status ${r.status}`);
    }
    if (onTo.has(who)) problems.push(`${who} is already registered on ${TO}`);
  }

  const ids = [...new Set(from.map((r) => r.userId))];
  const people = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(inArray(users.id, ids));
  const emailOf = new Map(people.map((p) => [p.id, p.email]));

  console.log(`\n${WRITE ? "MOVING" : "DRY RUN"}: ${from.length} registrations ${FROM} → ${TO}`);
  console.log(`${TO} currently holds ${to.length}\n`);
  for (const r of from) {
    console.log(`  ${r.status.padEnd(10)}  ${(emailOf.get(r.userId) ?? r.userId).padEnd(34)}  confirmedAt=${r.confirmedAt?.toISOString() ?? "-"}`);
  }

  if (problems.length > 0) {
    console.error(`\nREFUSING TO WRITE — ${problems.length} precondition failure(s):`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exitCode = 1;
    return;
  }

  if (!WRITE) {
    console.log(`\npreconditions OK — re-run with --write to apply`);
    return;
  }

  const moved = await db
    .update(eventRegistrations)
    .set({ eventSlug: TO })
    .where(eq(eventRegistrations.eventSlug, FROM))
    .returning({ id: eventRegistrations.id });

  console.log(`\nmoved ${moved.length} registrations to ${TO}`);
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
