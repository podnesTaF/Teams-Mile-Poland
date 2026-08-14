"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { adminRoleLabel, parseAdminRole } from "@/lib/auth/roles";

import { grantAdmin, normalizeEmail, revokeAdmin } from "./admin-grant";
import { adminPath, requireAdmin, safeLocale } from "./action-helpers";

/** Redirect back to the admins list with a status message. */
function back(locale: string, msg: string): never {
  revalidatePath(adminPath(locale, "/admins"));
  redirect(adminPath(locale, `/admins?msg=${encodeURIComponent(msg)}`));
}

/**
 * Invite an admin by email, or promote an existing account. Creates the account
 * when the email is unknown and sends the set-password link — see
 * {@link grantAdmin} for why that link is the whole security story.
 */
export async function inviteAdmin(formData: FormData) {
  const locale = safeLocale(formData.get("locale"));
  await requireAdmin(locale, "edit");

  const result = await grantAdmin({
    email: String(formData.get("email") ?? ""),
    role: parseAdminRole(formData.get("access")),
  });
  if (!result.ok) back(locale, result.error);

  if (result.outcome === "already-admin" && !result.invited) {
    back(locale, `${result.email} already has this access.`);
  }
  if (result.invited) {
    const lead =
      result.outcome === "created"
        ? `Admin created for ${result.email}`
        : `${result.email} is now an admin`;
    back(locale, `${lead} — set-password email sent. They stay "pending" here until they set it.`);
  }
  back(
    locale,
    `${result.email} is now an admin and can sign in with their existing password.`,
  );
}

/**
 * Re-send the set-password link — for an invite that never arrived, or an admin
 * who is locked out. Same link the public "forgot password" flow sends.
 */
export async function resendAdminInvite(formData: FormData) {
  const locale = safeLocale(formData.get("locale"));
  await requireAdmin(locale, "edit");

  const result = await grantAdmin({
    email: String(formData.get("email") ?? ""),
    forceInvite: true,
  });
  if (!result.ok) back(locale, result.error);
  back(locale, `Set-password email re-sent to ${result.email}.`);
}

/**
 * Remove someone's admin role. Blocked for your own account so an admin can't
 * accidentally lock themselves out of the panel they are standing in, and
 * blocked for the last admin (see {@link revokeAdmin}).
 */
export async function removeAdmin(formData: FormData) {
  const locale = safeLocale(formData.get("locale"));
  const actor = await requireAdmin(locale, "edit");

  const id = String(formData.get("id") ?? "");
  if (!id) back(locale, "No admin specified.");
  if (id === actor.id) {
    back(locale, "You can't remove your own admin access — ask another admin to do it.");
  }

  const result = await revokeAdmin(id);
  if (!result.ok) back(locale, result.error);
  back(locale, `${result.email} is no longer an admin.`);
}

/**
 * Move an admin to another access level (full / check-in / view-only). Blocked
 * for your own account for the same reason as {@link removeAdmin}; the
 * last-full-admin guard lives in {@link grantAdmin}.
 */
export async function changeAdminAccess(formData: FormData) {
  const locale = safeLocale(formData.get("locale"));
  const actor = await requireAdmin(locale, "edit");

  const email = String(formData.get("email") ?? "");
  const role = parseAdminRole(formData.get("access"));
  if (email && normalizeEmail(email) === normalizeEmail(actor.email)) {
    back(locale, "You can't change your own access level — ask another admin to do it.");
  }

  const result = await grantAdmin({ email, role, skipInvite: true });
  if (!result.ok) back(locale, result.error);
  if (result.outcome === "already-admin") {
    back(locale, `${result.email} already has ${adminRoleLabel(role)} access.`);
  }
  back(locale, `${result.email} now has ${adminRoleLabel(role)} access.`);
}
