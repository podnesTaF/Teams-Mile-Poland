/**
 * Admin access levels and what each one may do. Pure data + functions, safe to
 * import from client components (auth-nav) and from the Drizzle schema alike —
 * keep it free of server-only imports.
 *
 * Three roles:
 *  - `admin`         — full access: every page, every mutation, personal data.
 *  - `admin_checkin` — race-morning volunteer: sees the panel, runs check-in /
 *                      bib / heat-finish actions, mutates nothing else.
 *  - `admin_viewer`  — read-only: sees every admin page, mutates nothing.
 *
 * Capabilities are NOT a strictly nested ladder. `view`, `checkin` and `edit`
 * do nest (view ⊂ check-in ⊂ edit), but `personal_data` sits outside that
 * ladder: it gates the consent Statement surfaces, which carry a runner's date
 * of birth, home address, phone and an emergency contact's name and number.
 * `admin_checkin` holds `checkin` but not `personal_data` — a volunteer may
 * scan bibs but may not read addresses — and `edit` is not reused for it
 * because reading a statement mutates nothing (ADR 0007).
 *
 * Stored in the plain-text `users.role` column (see `src/db/schema/auth.ts`
 * for why it is text and not a pgEnum). A role set is a value, not a type.
 */

export const ADMIN_ROLES = ["admin", "admin_checkin", "admin_viewer"] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

/** What a call site needs, not who the caller is. */
export type AdminCapability = "view" | "edit" | "checkin" | "personal_data";

export function isAdminRole(role: string | null | undefined): role is AdminRole {
  return (ADMIN_ROLES as readonly string[]).includes(role ?? "");
}

/**
 * Whether `role` grants `capability`. Every admin role can view; check-in is
 * full access or the volunteer role; edit and personal data are full access
 * alone.
 */
export function roleHasCapability(
  role: string | null | undefined,
  capability: AdminCapability,
): boolean {
  if (!isAdminRole(role)) return false;
  switch (capability) {
    case "view":
      return true;
    case "checkin":
      return role === "admin" || role === "admin_checkin";
    case "edit":
      return role === "admin";
    case "personal_data":
      return role === "admin";
  }
}

/** Human label for the admins page and the invite form. */
export function adminRoleLabel(role: AdminRole): string {
  switch (role) {
    case "admin":
      return "Full access";
    case "admin_checkin":
      return "Check-in";
    case "admin_viewer":
      return "View only";
  }
}

/** Parse a form value into an admin role, defaulting to full access. */
export function parseAdminRole(value: unknown): AdminRole {
  return isAdminRole(typeof value === "string" ? value : "") ? (value as AdminRole) : "admin";
}
