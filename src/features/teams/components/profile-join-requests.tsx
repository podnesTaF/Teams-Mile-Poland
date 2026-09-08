import { getLocale, getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";

import { listPendingJoinRequestsForUser } from "../join-requests";
import { formatTeamDate } from "../mail-invitations";
import { JoinRequestWithdraw } from "./join-request-withdraw";

/**
 * "Requests you have sent" on the profile's `#teams` section (PRD #57, user
 * story 40): where a runner sees what they are still waiting on, and takes it
 * back if they change their mind.
 *
 * Renders nothing when there is none, exactly like the pending-invitation list
 * above it — a runner who has never asked to join anything should not be shown
 * an empty box about it, unlike "my teams", where zero teams is a state worth
 * naming.
 */
export async function ProfileJoinRequests({ userId }: { userId: string }) {
  const requests = await listPendingJoinRequestsForUser(userId);
  if (requests.length === 0) return null;

  const t = await getTranslations("teams.requests");
  const tForm = await getTranslations("teams.form");
  const locale = await getLocale();

  return (
    <div data-profile-join-requests={requests.length}>
      <h3 className="iv-title pf-h2">{t("profileHeading")}</h3>
      <div className="reg-list">
        {requests.map(({ request, team }) => (
          <div key={request.id} className="reg-card">
            <div className="reg-card__body">
              <Link className="reg-card__title" href={`/teams/${team.slug}`}>
                {team.name}
              </Link>
              <div className="reg-card__meta">
                <span>{tForm(`categoryOption.${team.category}`)}</span>
                <span>{team.region}</span>
                <span>{t("asked", { date: formatTeamDate(request.createdAt, locale) })}</span>
                <span>{t("waiting")}</span>
              </div>
            </div>
            <div className="reg-card__actions">
              <JoinRequestWithdraw requestId={request.id} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
