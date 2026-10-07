import { getLocale, getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";

import type { TeamJoinRequestStatus } from "../config";
import { listJoinRequestsForUser } from "../join-requests";
import { formatTeamDate } from "../mail-invitations";
import { JoinRequestWithdraw } from "./join-request-withdraw";

/** Status pill per request state — the same `.status` palette the event cards use. */
const STATUS_CLASS: Record<TeamJoinRequestStatus, string> = {
  pending: "status--soon",
  accepted: "status--registered",
  declined: "status--closed",
  withdrawn: "status--closed",
};

/**
 * "Requests you have sent" on the profile's `#teams` section (PRD #57, user
 * story 40): where a runner sees what they are still waiting on, takes it back
 * if they change their mind, and — for a month after — what the manager
 * answered. An accepted request shows here as well as under "my teams", so the
 * runner sees the answer to the question they asked, not just a new card.
 *
 * Renders nothing when there is none, exactly like the pending-invitation list
 * above it — a runner who has never asked to join anything should not be shown
 * an empty box about it, unlike "my teams", where zero teams is a state worth
 * naming.
 */
export async function ProfileJoinRequests({ userId }: { userId: string }) {
  const requests = await listJoinRequestsForUser(userId);
  if (requests.length === 0) return null;

  const t = await getTranslations("teams.requests");
  const tForm = await getTranslations("teams.form");
  const locale = await getLocale();

  return (
    <div data-profile-join-requests={requests.length}>
      <h3 className="iv-title pf-h2">{t("profileHeading")}</h3>
      <div className="reg-list">
        {requests.map(({ request, team }) => (
          <div
            key={request.id}
            className="reg-card reg-card--plain"
            data-join-request-status={request.status}
          >
            <div className="reg-card__body">
              <Link className="reg-card__title" href={`/teams/${team.slug}`}>
                {team.name}
              </Link>
              <div className="reg-card__meta">
                <span>{tForm(`categoryOption.${team.category}`)}</span>
                <span>{team.region}</span>
                <span>{t("asked", { date: formatTeamDate(request.createdAt, locale) })}</span>
                {request.decidedAt && request.status !== "pending" ? (
                  <span>
                    {t("decidedOn", { date: formatTeamDate(request.decidedAt, locale) })}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="reg-card__actions">
              <span className={`status ${STATUS_CLASS[request.status]}`}>
                <span className="status__dot" aria-hidden="true" />
                {t(`requestStatus.${request.status}`)}
              </span>
              {request.status === "pending" ? (
                <JoinRequestWithdraw requestId={request.id} />
              ) : request.status === "accepted" ? (
                <Link className="btn btn-sm btn-stroke-dark" href={`/teams/${team.slug}`}>
                  {t("openTeam")}
                </Link>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
