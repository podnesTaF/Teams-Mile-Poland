import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";

import { getMyTeams } from "../data";
import { ProfileInvitations } from "./profile-invitations";

/**
 * The profile's `#teams` section — one place for a runner's team life.
 *
 * #59 ships "my teams" and the create link; the pending-invitation and
 * pending-request lists arrive with #60 and #61 at the marked slots. Rendering
 * the empty state and the list from the same component keeps the "zero teams"
 * case honest: it is a state, not a missing section.
 */
export async function ProfileTeamsSection({ userId }: { userId: string }) {
  const t = await getTranslations("teams.profile");
  const tPage = await getTranslations("teams.page");
  const tProfile = await getTranslations("profile");
  const tForm = await getTranslations("teams.form");

  const teams = await getMyTeams(userId);

  return (
    <section className="regs-section pf-section" id="teams">
      <div className="section-label">
        <span className="iv-eyebrow">{tProfile("teams.title")}</span>
      </div>
      <h2 className="iv-title pf-h2">{tProfile("teams.heading")}</h2>

      {teams.length === 0 ? (
        <div className="regs-empty" data-my-teams="empty">
          {t("empty")}
        </div>
      ) : (
        <div className="reg-list" data-my-teams={teams.length}>
          {teams.map(({ team, role, completeness }) => (
            <div key={team.id} className="reg-card">
              <div className="reg-card__body">
                <span className="reg-card__title">{team.name}</span>
                <div className="reg-card__meta">
                  <span>{tForm(`categoryOption.${team.category}`)}</span>
                  <span>{team.region}</span>
                  <span>{tPage(`role.${role}`)}</span>
                  <span>
                    {completeness.complete
                      ? tPage("completenessComplete", {
                          count: completeness.count,
                          min: completeness.min,
                        })
                      : tPage("completenessNeeded", {
                          count: completeness.count,
                          min: completeness.min,
                          missing: completeness.missing,
                        })}
                  </span>
                </div>
              </div>
              <div className="reg-card__actions">
                <Link className="btn btn-sm btn-stroke-dark" href={`/teams/${team.slug}`}>
                  {t("open")}
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* SLOT — #60 pending invitations on the profile (accept / decline). */}
      <ProfileInvitations userId={userId} />


      {/*
        SLOT — #61 pending join requests on the profile (with withdraw). One line:
          <ProfileJoinRequests userId={userId} />
      */}

      <div className="iv-actions" style={{ marginTop: 16 }}>
        <Link className="btn btn-red" href="/teams/new">
          {t("create")}
        </Link>
      </div>
    </section>
  );
}
