/**
 * Does React `cache()` memoize `loadEvents` outside a request scope?
 * Decides whether a fixture script can mutate-then-read in one process. Temp.
 */
import { eq } from "drizzle-orm";

import { events } from "../src/db/schema/events";
import { db } from "../src/lib/db";
import { getEventBySlug } from "../src/lib/events/store";
import { requireFixtureConsent } from "./lib/guard";

const SLUG = "tmp-cache-probe-2027-01-01";

async function main() {
  requireFixtureConsent("scripts/tmp-eam-cache-probe.ts");
  try {
    console.log("before insert, getEventBySlug:", (await getEventBySlug(SLUG))?.slug ?? "undefined");
    await db!.insert(events).values({
      slug: SLUG,
      status: "draft",
      eventType: "individual",
      name: "cache probe",
      date: "2027-01-01",
      venue: "probe",
      city: "probe",
    });
    console.log("after insert,  getEventBySlug:", (await getEventBySlug(SLUG))?.slug ?? "undefined");
  } finally {
    await db!.delete(events).where(eq(events.slug, SLUG));
    console.log("cleaned up:", (await db!.select().from(events).where(eq(events.slug, SLUG))).length === 0);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(String(e).slice(0, 600));
  process.exit(1);
});
