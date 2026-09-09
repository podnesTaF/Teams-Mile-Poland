import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";

import { TEAM_CATEGORIES, type TeamCategory } from "../config";
import { getManagerFirstNames, getRosterSeats, listRecruitingTeams } from "../data";
import { computeCompleteness } from "../eligibility";
import { TeamTile } from "./team-card";

/**
 * `/teams` — the public recruiting list: every team that has declared itself
 * **Recruiting**, newest first, filterable by category (PRD #57, user story 27).
 *
 * The filter is server-rendered links over `?category=`, not an island: it has
 * four states, no local state worth keeping, and as plain links each filtered
 * view is a URL a manager can send to a runner.
 *
 * Tiles are {@link TeamTile}, which lives beside the {@link TeamCard} the team
 * page shows a non-member — one file decides what a stranger may see, which is
 * what guarantees this surface can never grow roster names. Every tile on this
 * page is recruiting by definition, so none of them repeats the "looking for
 * runners" pill the team page carries. Three queries total regardless of how
 * many teams: the teams, their seats, their managers' first names.
 */
export async function RecruitingList({ category }: { category?: TeamCategory }) {
  const t = await getTranslations("teams.requests");
  const tForm = await getTranslations("teams.form");

  const teams = await listRecruitingTeams(category);
  const [seatsByTeam, managerNames] = await Promise.all([
    getRosterSeats(teams.map((team) => team.id)),
    getManagerFirstNames(teams.map((team) => team.managerUserId)),
  ]);

  return (
    <>
      <nav
        className="team-filters"
        data-category-active={category ?? "all"}
        aria-label={t("filterLabel")}
      >
        <FilterLink label={t("filterAll")} value={undefined} active={category === undefined} />
        {TEAM_CATEGORIES.map((option) => (
          <FilterLink
            key={option}
            label={tForm(`categoryOption.${option}`)}
            value={option}
            active={category === option}
          />
        ))}
      </nav>

      {teams.length === 0 ? (
        <div className="regs-empty" data-recruiting="empty">
          {category ? t("listEmptyCategory") : t("listEmpty")}
        </div>
      ) : (
        <div className="team-grid" data-recruiting={teams.length}>
          {teams.map((team) => (
            <TeamTile
              key={team.id}
              team={team}
              completeness={computeCompleteness(team.category, seatsByTeam.get(team.id) ?? [])}
              managerFirstName={managerNames.get(team.managerUserId) ?? null}
              action={
                <Link className="btn btn-red btn-sm" href={`/teams/join/${team.code}`}>
                  {t("askToJoin")}
                </Link>
              }
            />
          ))}
        </div>
      )}
    </>
  );
}

/** One filter pill. `undefined` is "all", which is the bare `/teams` URL. */
function FilterLink({
  label,
  value,
  active,
}: {
  label: string;
  value: TeamCategory | undefined;
  active: boolean;
}) {
  return (
    <Link
      className="team-filter"
      href={value ? `/teams?category=${value}` : "/teams"}
      aria-current={active ? "page" : undefined}
      data-category-filter={value ?? "all"}
      data-active={active ? "true" : undefined}
    >
      {label}
    </Link>
  );
}
