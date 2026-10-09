import { getTranslations } from "next-intl/server";

import type { UserTeamRow } from "@/db/schema/user-teams";

import type { RosterSummary } from "../eligibility";
import { RosterCountTile } from "./roster-count-tile";

/**
 * The team card every visitor sees: name, region, category, the runner count,
 * description and the **captain's first name**.
 *
 * Deliberately carries no roster names — members never consented to being
 * listed publicly and no start list exists yet (PRD #57, "Public surfaces show
 * no roster names"). The roster is a separate component the page renders only
 * for members and admin.
 */
export async function TeamCard({
  team,
  roster,
  managerFirstName,
}: {
  team: UserTeamRow;
  roster: RosterSummary;
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
        <RosterCountTile roster={roster} showSplit={false} />
      </div>

      {team.description ? <p className="iv-sub">{team.description}</p> : null}

      <div className="team-card__foot">
        {managerFirstName ? <span>{t("managerIs", { name: managerFirstName })}</span> : null}
        {/* No "looking for runners" chip: teams take members by invitation
            only, so `recruiting` is an admin hint, not a public claim (ADR 0016). */}
      </div>
    </section>
  );
}
