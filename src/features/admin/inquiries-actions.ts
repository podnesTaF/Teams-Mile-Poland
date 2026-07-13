"use server";

import { revalidatePath } from "next/cache";

import { adminPath, requireAdmin, safeLocale } from "./action-helpers";
import { deleteInquiryById, setInquiryStatus } from "./inquiries-data";

export async function markInquiryHandled(formData: FormData) {
  const locale = safeLocale(formData.get("locale"));
  await requireAdmin(locale);
  const id = String(formData.get("id") ?? "");
  const next = String(formData.get("next") ?? "handled") === "new" ? "new" : "handled";
  if (id) await setInquiryStatus(id, next);
  revalidatePath(adminPath(locale, "/inquiries"));
}

export async function deleteInquiry(formData: FormData) {
  const locale = safeLocale(formData.get("locale"));
  await requireAdmin(locale);
  const id = String(formData.get("id") ?? "");
  if (id) await deleteInquiryById(id);
  revalidatePath(adminPath(locale, "/inquiries"));
}
