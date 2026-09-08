import type { TeamCategory } from "@/features/teams/config";

/**
 * English labels and formatters for the `/admin/teams` surfaces (#63).
 *
 * The public team pages read these from `teams.form.categoryOption.*` in the
 * viewer's locale; admin is English-only by convention (cross-cutting checklist
 * §1), so the panel carries its own literals rather than reaching into a
 * translated catalog it would render half of.
 *
 * The category map is total over {@link TeamCategory} on purpose — adding a
 * category is a compile error here until the panel names it.
 */
export const ADMIN_TEAM_CATEGORY_LABEL: Record<TeamCategory, string> = {
  men: "Men",
  women: "Women",
  mixed: "Mixed",
};

/** "8 Sep 2026", Warsaw-anchored — the tone the rest of the panel uses. */
export const ADMIN_TEAM_DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Europe/Warsaw",
});

/** The same instant with the time, for an invitation's expiry. */
export const ADMIN_TEAM_DATETIME = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Warsaw",
});

/** How `users.sex` reads in the roster table. */
export function adminTeamSexLabel(sex: "M" | "F" | null): string {
  if (sex === "M") return "Man";
  if (sex === "F") return "Woman";
  return "—";
}
