import { getTranslations } from "next-intl/server";

import type { RosterMember } from "../data";
import type { TeamCompleteness } from "../eligibility";
import { RosterControls } from "./roster-controls";
import { TeamCompletenessTile } from "./team-completeness";

/**
 * The roster with names and roles — **members and admin only**. The page decides
 * who sees it; this component never gates itself, so there is one place to read
 * the rule from.
 */
export async function TeamRoster({
  slug,
  roster,
  completeness,
  viewerUserId,
  isManager,
}: {
  /** The team's slug — every roster-change action is addressed by it. */
  slug: string;
  roster: RosterMember[];
  completeness: TeamCompleteness;
  viewerUserId: string | null;
  /** The manager, or an admin holding `edit`. Decides which controls render. */
  isManager: boolean;
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

      {/* SLOT — #62 roster changes: leave / remove / hand over / dissolve.
          Projected to three fields on purpose: island props are serialized into
          the page, and `RosterMember` carries every member's email. */}
      <RosterControls
        slug={slug}
        roster={roster.map((m) => ({
          userId: m.userId,
          displayName: m.displayName,
          role: m.role,
        }))}
        viewerUserId={viewerUserId}
        isManager={isManager}
      />
    </section>
  );
}
