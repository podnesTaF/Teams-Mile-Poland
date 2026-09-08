import { getTranslations } from "next-intl/server";

import type { UserTeamRow } from "@/db/schema/user-teams";

import type { TeamCompleteness } from "../eligibility";
import { TeamCompletenessTile } from "./team-completeness";

/**
 * The team card every visitor sees: name, region, category, count against
 * target, description and the **manager's first name**.
 *
 * Deliberately carries no roster names — members never consented to being
 * listed publicly and no start list exists yet (PRD #57, "Public surfaces show
 * no roster names"). The roster is a separate component the page renders only
 * for members and admin.
 */
export async function TeamCard({
  team,
  completeness,
  managerFirstName,
}: {
  team: UserTeamRow;
  completeness: TeamCompleteness;
  managerFirstName: string | null;
}) {
  const t = await getTranslations("teams.page");
  const tForm = await getTranslations("teams.form");

  return (
    <section className="iv-card" data-team-card={team.slug}>
      <span className="iv-eyebrow">{t("eyebrow")}</span>
      <h1 className="iv-title">{team.name}</h1>

      <div className="pf-ref-stats">
        <div className="iv-info">
          <div className="iv-info__label">{t("category")}</div>
          <div className="iv-info__value">{tForm(`categoryOption.${team.category}`)}</div>
        </div>
        <div className="iv-info">
          <div className="iv-info__label">{t("region")}</div>
          <div className="iv-info__value">{team.region}</div>
        </div>
        <TeamCompletenessTile completeness={completeness} showSplit={false} />
      </div>

      {team.description ? <p className="iv-sub">{team.description}</p> : null}

      <div className="iv-share__hint">
        {managerFirstName ? t("managerIs", { name: managerFirstName }) : null}
        {team.recruiting ? <> · {t("recruitingOn")}</> : null}
      </div>
    </section>
  );
}
