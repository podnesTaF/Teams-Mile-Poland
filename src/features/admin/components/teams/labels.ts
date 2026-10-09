import {
  placementTeamShortLabel,
  type PlacementTeamSlug,
  type RaceFormat,
  type TeamCategory,
} from "@/features/teams/config";

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

/**
 * A roster filter on race (#84, ADR 0016): `"mile"` for the individual rated
 * mile, or a placement team's slug for its team race. What `?race=` carries.
 */
export type AdminRaceFilter = "mile" | PlacementTeamSlug;

/**
 * A placement team as the admin roster names it: its colour and its category
 * ("RED men", "BLACK women"). The colour alone is what a runner's ticket
 * prints, but the men's and women's team of one colour share it, so the
 * manager's view adds the category. A slug that is not a placement team's prints
 * as itself.
 */
export function adminPlacementTeamLabel(slug: string, category: TeamCategory | null): string {
  const colour = placementTeamShortLabel(slug) ?? slug;
  return category && category !== "mixed" ? `${colour} ${category}` : colour;
}

/**
 * A registration's race as the roster column, its drawer and the xlsx export
 * print it: "Mile" for the individual mile, "Team · RED men" for a team-race
 * row. A team row whose team has since been deleted (`team_id` set null)
 * still says it was a team race — "Team".
 */
export function adminRaceLabel(race: {
  raceFormat: RaceFormat;
  teamSlug: string | null;
  teamCategory: TeamCategory | null;
}): string {
  if (race.raceFormat !== "team") return "Mile";
  return race.teamSlug ? `Team · ${adminPlacementTeamLabel(race.teamSlug, race.teamCategory)}` : "Team";
}
