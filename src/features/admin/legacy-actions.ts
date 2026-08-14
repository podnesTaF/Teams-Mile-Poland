"use server";

import { revalidatePath } from "next/cache";

import { adminPath, requireAdmin, safeLocale } from "./action-helpers";
import { deleteRunnerCascade, deleteTeamCascade } from "./legacy-data";

export async function removeTeam(formData: FormData) {
  const locale = safeLocale(formData.get("locale"));
  await requireAdmin(locale, "edit");
  const id = String(formData.get("id") ?? "");
  if (id) await deleteTeamCascade(id);
  revalidatePath(adminPath(locale, "/legacy"));
}

export async function removeRunner(formData: FormData) {
  const locale = safeLocale(formData.get("locale"));
  await requireAdmin(locale, "edit");
  const id = String(formData.get("id") ?? "");
  if (id) await deleteRunnerCascade(id);
  revalidatePath(adminPath(locale, "/legacy"));
}
