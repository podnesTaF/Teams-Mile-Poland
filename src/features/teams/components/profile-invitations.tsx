import { eq } from "drizzle-orm";
import { getLocale, getTranslations } from "next-intl/server";

import { users } from "@/db/schema/auth";
import { getDb } from "@/lib/db";

import { listOpenInvitationsForEmail } from "../invitations";
import { formatTeamDate } from "../mail-invitations";
import { DecisionButtons } from "./invitation-decision";

/**
 * "Invitations waiting for you" on the profile's `#teams` section (PRD #57,
 * user story 39: accept without hunting for the email).
 *
 * Matched on the account's address **case-insensitively**, because the address
 * was typed by a manager rather than picked from a list. Renders nothing at all
 * when there is none: an empty block on a profile that has never been invited is
 * noise, unlike "my teams", where zero teams is a state worth naming.
 *
 * The buttons pass the invitation **id** — the raw token exists only in the
 * mailed link — and `respondToInvitation` requires the address to match for
 * that path.
 */
export async function ProfileInvitations({ userId }: { userId: string }) {
  const db = getDb();
  const [account] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!account) return null;

  const invitations = await listOpenInvitationsForEmail(account.email);
  if (invitations.length === 0) return null;

  const t = await getTranslations("teams.invitations");
  const tForm = await getTranslations("teams.form");
  const locale = await getLocale();

  return (
    <div data-profile-invitations={invitations.length}>
      <h3 className="iv-title pf-h2">{t("profileHeading")}</h3>
      <div className="reg-list">
        {invitations.map(({ invitation, team }) => (
          <div key={invitation.id} className="reg-card">
            <div className="reg-card__body">
              <span className="reg-card__title">{team.name}</span>
              <div className="reg-card__meta">
                <span>{tForm(`categoryOption.${team.category}`)}</span>
                <span>{team.region}</span>
                <span>{t("expires", { date: formatTeamDate(invitation.expiresAt, locale) })}</span>
                {invitation.onBehalf ? <span>{t("onBehalfTag")}</span> : null}
              </div>
            </div>
            <div className="reg-card__actions">
              <DecisionButtons token={invitation.id} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
