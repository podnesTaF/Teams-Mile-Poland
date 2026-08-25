/** Pre/post snapshot of the real rows, so the verification can prove it moved nothing. Temp. */
import { sql } from "drizzle-orm";

import { db } from "../src/lib/db";

async function main() {
  const res = await db!.execute(sql`
    select 'users' t, count(*)::text c from users
    union all select 'registrations', count(*)::text from event_registrations
    union all select 'results', count(*)::text from event_results
    union all select 'heats', count(*)::text from event_heats
    union all select 'media', count(*)::text from event_media
    union all select 'email_log', count(*)::text from event_email_log
    union all select 'legacy_participations', count(*)::text from legacy_participations
    order by 1`);
  const rows = (Array.isArray(res) ? res : (res as { rows: unknown[] }).rows) as {
    t: string;
    c: string;
  }[];
  console.log(rows.map((r) => `${r.t}=${r.c}`).join(" "));
  process.exit(0);
}

main().catch((e) => {
  console.error(String(e).slice(0, 400));
  process.exit(1);
});
