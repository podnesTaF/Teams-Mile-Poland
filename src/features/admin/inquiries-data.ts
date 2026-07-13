import { desc, eq } from "drizzle-orm";

import { contactInquiries } from "@/db/schema";
import { getDb } from "@/lib/db";

export type InquiryRow = typeof contactInquiries.$inferSelect;

/** All contact inquiries, newest first. */
export async function listInquiries(): Promise<InquiryRow[]> {
  return getDb().select().from(contactInquiries).orderBy(desc(contactInquiries.createdAt));
}

export async function setInquiryStatus(id: string, status: "new" | "handled") {
  await getDb().update(contactInquiries).set({ status }).where(eq(contactInquiries.id, id));
}

export async function deleteInquiryById(id: string) {
  await getDb().delete(contactInquiries).where(eq(contactInquiries.id, id));
}
