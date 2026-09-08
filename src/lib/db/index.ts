import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";

export const db = process.env.DATABASE_URL
  ? drizzle(postgres(process.env.DATABASE_URL, { prepare: false }), { schema })
  : null;

export function getDb() {
  if (!db) {
    throw new Error("DATABASE_URL is not set");
  }

  return db;
}

/** The connection pool's Drizzle client. */
export type Database = NonNullable<typeof db>;

/** The `tx` handle inside `db.transaction(async (tx) => …)`. */
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

/**
 * Something a query may run on: the pool, or an open transaction.
 *
 * Data-layer functions that take one of these as an optional last parameter can
 * be composed into a caller's transaction without being rewritten — the pattern
 * team check-in needs (PRD #64), where seven bib leases, the composition write
 * and the entry's status transition must land together or not at all. Passing
 * nothing keeps the standalone behaviour, which is what every existing caller
 * does.
 */
export type DbExecutor = Database | Transaction;

/** `tx` when the caller is inside a transaction, the pool when it is not. */
export function executor(tx?: DbExecutor): Database {
  // A `Transaction` carries every query builder a `Database` does (it extends
  // the same `PgDatabase`), so the cast is a narrowing convenience for callers
  // rather than a claim about capability: nothing here calls `db`-only members.
  return (tx ?? getDb()) as Database;
}
