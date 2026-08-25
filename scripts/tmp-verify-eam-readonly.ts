/** Read-only reconnaissance for the event-admin-management verification. Temp. */
import { sql } from "drizzle-orm";
import { db } from "../src/lib/db";

async function q(label: string, statement: ReturnType<typeof sql>) {
  const res = await db!.execute(statement);
  const rows = Array.isArray(res) ? res : (res as { rows: unknown[] }).rows;
  console.log(`\n### ${label}`);
  console.log(JSON.stringify(rows, null, 1));
  return rows as Record<string, unknown>[];
}

async function main() {
  if (!db) { console.log("no db"); process.exit(1); }
  await q("migration watermark (last 4)", sql`
    select id, created_at from drizzle.__drizzle_migrations order by created_at desc limit 4`);
  await q("events table exists?", sql`
    select column_name, data_type, is_nullable, column_default
    from information_schema.columns where table_name = 'events' order by ordinal_position`);
  await q("events rows", sql`
    select slug, status, event_type, name, date, start_time, end_time, bib_pool,
           heat_interval_minutes, created_by
    from events order by date`).catch(() => { console.log("(no events table)"); return []; });
  await q("events indexes", sql`
    select indexname, indexdef from pg_indexes where tablename = 'events'`);
  await q("row counts per slug", sql`
    select 'registrations' as t, event_slug as slug, count(*) from event_registrations group by 2
    union all select 'results', event_slug, count(*) from event_results group by 2
    union all select 'heats', event_slug, count(*) from event_heats group by 2
    union all select 'media', event_slug, count(*) from event_media group by 2
    order by 1,2`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
