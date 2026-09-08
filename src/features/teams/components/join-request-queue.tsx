import { getTranslations } from "next-intl/server";

import { getTeamBySlug } from "../data";
import { listPendingJoinRequests } from "../join-requests";
import { formatTeamDate } from "../mail-invitations";
import { JoinRequestDecision } from "./join-request-decision";

/**
 * The manager panel's join-request queue: who has knocked, and Accept / Decline
 * for each (PRD #57, user story 32).
 *
 * Names appear here and nowhere public — this block renders only inside the
 * manager view, which is already behind `requireTeamManagerOrAdmin`'s page-side
 * twin. The empty state is stated rather than hidden: "nobody has asked" is
 * information a manager who has just shared the code wants.
 */
export async function JoinRequestQueue({ slug, locale }: { slug: string; locale: string }) {
  const t = await getTranslations("teams.requests");

  // By slug rather than by a `team` prop: the slot line in `team-manager-panel`
  // passes the slug, and one extra indexed lookup keeps this block independent
  // of what that panel happens to have already loaded.
  const team = await getTeamBySlug(slug);
  if (!team) return null;

  const requests = await listPendingJoinRequests(team.id);

  return (
    <div data-join-request-queue={slug}>
      <h3 className="iv-title pf-h2">{t("queueHeading")}</h3>

      {requests.length === 0 ? (
        <div className="regs-empty" data-join-requests="empty">
          {t("queueEmpty")}
        </div>
      ) : (
        <div className="reg-list" data-join-requests={requests.length}>
          {requests.map(({ request, displayName }) => (
            <div key={request.id} className="reg-card">
              <div className="reg-card__body">
                <span className="reg-card__title">{displayName}</span>
                <div className="reg-card__meta">
                  <span>{t("asked", { date: formatTeamDate(request.createdAt, locale) })}</span>
                </div>
              </div>
              <div className="reg-card__actions">
                <JoinRequestDecision requestId={request.id} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
