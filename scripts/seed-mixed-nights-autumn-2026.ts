/**
 * One-off: create the three autumn 2026 mixed nights (ADR 0009) — 22.09, 01.10
 * and 10.10 — as `mixed`-type events open for registration.
 *
 *   npx tsx --env-file=.env.local scripts/seed-mixed-nights-autumn-2026.ts
 *
 * Mirrors `createEvent` (`features/admin/event-actions.ts`) field for field, with
 * two deliberate differences: the status lands as `registration_open` rather
 * than `draft` (the owner asked for nights people can join), and `createdBy` is
 * null like the registry-seeded rows. Idempotent: a date whose `mile-<date>`
 * slug already exists is skipped, never rewritten (slugs are immutable — six
 * tables key off them). Public pages bypassed by this write self-heal within
 * `revalidate = 300` s; the admin Settings tab is the place to adjust a window,
 * pool or slot list afterwards.
 */
import { events } from "../src/db/schema/events";
import { generateEventSlug } from "../src/features/admin/event-slug";
import { getDb } from "../src/lib/db";
import { DEFAULT_VENUE, EVENING, MORNING } from "../src/lib/events/registry";
import { DEFAULT_BIB_POOL, DEFAULT_HEAT_INTERVAL_MINUTES } from "../src/lib/events/types";
import { eq } from "drizzle-orm";

const NAME = "Teams & Individual Mile";

/** Weekday nights run the evening window; the Saturday runs the morning one. */
const NIGHTS = [
  { date: "2026-09-22", window: EVENING }, // Tuesday
  { date: "2026-10-01", window: EVENING }, // Thursday
  { date: "2026-10-10", window: MORNING }, // Saturday
] as const;

async function main() {
  const db = getDb();
  for (const night of NIGHTS) {
    const base = `mile-${night.date}`;
    const [existing] = await db
      .select({ slug: events.slug, status: events.status, eventType: events.eventType })
      .from(events)
      .where(eq(events.slug, base))
      .limit(1);
    if (existing) {
      console.log(`${base}: already exists (${existing.eventType}, ${existing.status}) — skipped`);
      continue;
    }
    const slug = await generateEventSlug(night.date);
    await db.insert(events).values({
      slug,
      status: "registration_open",
      eventType: "mixed",
      name: NAME,
      date: night.date,
      startTime: night.window.start,
      endTime: night.window.end,
      venue: DEFAULT_VENUE.venue,
      city: DEFAULT_VENUE.city,
      bibPool: DEFAULT_BIB_POOL,
      bibSlots: null,
      heatIntervalMinutes: DEFAULT_HEAT_INTERVAL_MINUTES,
      createdBy: null,
    });
    console.log(`${slug}: created (mixed, registration_open, ${night.window.start}–${night.window.end})`);
  }
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
