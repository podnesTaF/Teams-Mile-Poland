import { getTranslations } from "next-intl/server";

import type { RosterMember } from "../data";
import type { TeamCompleteness } from "../eligibility";
import { TeamCompletenessTile } from "./team-completeness";

/**
 * The roster with names and roles — **members and admin only**. The page decides
 * who sees it; this component never gates itself, so there is one place to read
 * the rule from.
 */
export async function TeamRoster({
  roster,
  completeness,
  viewerUserId,
}: {
  roster: RosterMember[];
  completeness: TeamCompleteness;
  viewerUserId: string | null;
}) {
  const t = await getTranslations("teams.page");

  return (
    <section className="regs-section pf-section" id="roster">
      <div className="section-label">
        <span className="iv-eyebrow">{t("rosterTitle")}</span>
      </div>
      <h2 className="iv-title pf-h2">{t("rosterHeading")}</h2>

      <div className="pf-ref-stats">
        <TeamCompletenessTile completeness={completeness} />
      </div>

      <div className="reg-list" data-team-roster="1">
        {roster.map((member) => (
          <div key={member.userId} className="reg-card">
            <div className="reg-card__body">
              <span className="reg-card__title">
                {member.displayName}
                {member.userId === viewerUserId ? ` ${t("rosterYou")}` : ""}
              </span>
              <div className="reg-card__meta">
                <span>{t(`role.${member.role}`)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/*
        Slot for #62 (roster changes): the leave / remove / hand-over / dissolve
        controls render here, one line, e.g.
          <RosterControls team={team} roster={roster} viewerUserId={viewerUserId} isManager={isManager} />
        Everything they need is already in this component's props.
      */}
    </section>
  );
}
