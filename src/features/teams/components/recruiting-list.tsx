import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";

import { TEAM_CATEGORIES, type TeamCategory } from "../config";
import { getManagerFirstNames, getRosterSeats, listRecruitingTeams } from "../data";
import { computeCompleteness } from "../eligibility";
import { TeamCard } from "./team-card";

/**
 * `/teams` — the public recruiting list: every team that has declared itself
 * **Recruiting**, newest first, filterable by category (PRD #57, user story 27).
 *
 * The filter is server-rendered links over `?category=`, not an island: it has
 * four states, no local state worth keeping, and as plain links each filtered
 * view is a URL a manager can send to a runner.
 *
 * Cards are the same {@link TeamCard} the team page shows a non-member, which is
 * what guarantees this surface can never grow roster names — the one component
 * that decides what a stranger may see is shared by both. Three queries total
 * regardless of how many teams: the teams, their seats, their managers' first
 * names.
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
      <nav className="iv-actions" data-category-active={category ?? "all"} aria-label={t("filterLabel")}>
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
        <div data-recruiting={teams.length}>
          {teams.map((team) => (
            <div key={team.id} className="reg-card" data-recruiting-team={team.slug}>
              <TeamCard
                team={team}
                completeness={computeCompleteness(
                  team.category,
                  seatsByTeam.get(team.id) ?? [],
                )}
                managerFirstName={managerNames.get(team.managerUserId) ?? null}
              />
              <div className="iv-actions">
                <Link className="btn btn-red btn-sm" href={`/teams/join/${team.code}`}>
                  {t("askToJoin")}
                </Link>
              </div>
            </div>
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
      className={active ? "btn btn-red btn-sm" : "btn btn-stroke-dark btn-sm"}
      href={value ? `/teams?category=${value}` : "/teams"}
      aria-current={active ? "page" : undefined}
      data-category-filter={value ?? "all"}
    >
      {label}
    </Link>
  );
}
