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
