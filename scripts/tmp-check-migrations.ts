/** Read-only check: which migrations has the live DB applied? (temp, delete me) */
import { sql } from "drizzle-orm";

import { db } from "../src/lib/db";

async function main() {
  if (!db) {
    console.log("no db configured");
    process.exit(1);
  }
  const rows = await db.execute(
    sql`select id, hash, created_at from drizzle.__drizzle_migrations order by created_at`,
  );
  const list = Array.isArray(rows) ? rows : (rows as { rows: unknown[] }).rows;
  for (const r of list as { id: number; hash: string; created_at: string }[]) {
    console.log(r.id, r.created_at, String(r.hash).slice(0, 12));
  }
  console.log("count:", list.length);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
