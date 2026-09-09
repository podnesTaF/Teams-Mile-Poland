import { getTranslations } from "next-intl/server";

import type { UserTeamRow } from "@/db/schema/user-teams";

import { TEAM_LIMITS } from "../config";
import { getRosterSeats } from "../data";
import { listOpenInvitations } from "../invitations";
import { formatTeamDate } from "../mail-invitations";
import { InvitationRowActions } from "./invitation-row-actions";
import { InviteForm } from "./invite-form";

/**
 * The captain panel's invitations block: the invite-by-email form and the
 * pending invitations with their expiry, Resend and Revoke (PRD #57, user
 * story 18).
 *
 * The seat arithmetic is shown rather than hidden, because it is also the
 * refusal rule: open invitations may never exceed the empty seats, so a captain
 * who cannot invite should be able to see why before pressing the button
 * (`inviteByEmail` enforces it regardless — this is the explanation, not the
 * gate).
 */
export async function InvitationsPanel({ team, locale }: { team: UserTeamRow; locale: string }) {
  const t = await getTranslations("teams.invitations");

  const [seatsByTeam, open] = await Promise.all([
    getRosterSeats([team.id]),
    listOpenInvitations(team.id),
  ]);
  const taken = (seatsByTeam.get(team.id) ?? []).length;
  const remaining = Math.max(0, TEAM_LIMITS[team.category].max - taken - open.length);

  return (
    <div className="pf-block" data-invitations-panel={team.slug}>
      <h2 className="iv-title pf-h2">{t("panelHeading")}</h2>
      <p className="pf-block__sub">
        {remaining > 0 ? t("seatsLeft", { count: remaining }) : t("seatsNone")}
      </p>

      <InviteForm slug={team.slug} disabled={remaining === 0} />

      <h3 className="pf-h3">{t("pendingTitle")}</h3>
      {open.length === 0 ? (
        <div className="regs-empty regs-empty--tight" data-invitations="empty">
          {t("pendingEmpty")}
        </div>
      ) : (
        <div className="reg-list" data-invitations={open.length}>
          {open.map((invitation) => (
            <div key={invitation.id} className="reg-card reg-card--plain">
              <div className="reg-card__body">
                <span className="reg-card__title reg-card__title--text">{invitation.email}</span>
                <div className="reg-card__meta">
                  <span>{t("expires", { date: formatTeamDate(invitation.expiresAt, locale) })}</span>
                  {invitation.onBehalf ? <span>{t("onBehalfTag")}</span> : null}
                </div>
              </div>
              <InvitationRowActions invitationId={invitation.id} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
