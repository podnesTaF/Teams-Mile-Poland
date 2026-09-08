import { getTranslations } from "next-intl/server";

/**
 * "Who has confirmed" — the entry page's checklist (PRD #64, user stories 7
 * and 26).
 *
 * A server component and read-only for everyone, manager included: the manager's
 * buttons live in `entry-manager-controls.tsx` so that the *same* list renders
 * for a member, and there is one description of the entry rather than two that
 * can disagree.
 *
 * Confirmed means `consent_pending = false` and nothing else (PRD #64,
 * Cross-Cutting Decision 3). The row deliberately carries no email address and
 * no date of birth — the checklist answers "has this person acted", and the
 * personal data behind that answer belongs to the member and the organiser.
 */

/** One checklist row. A narrow projection of `EntryMemberView` on purpose. */
export type ChecklistMember = {
  userId: string;
  displayName: string;
  confirmed: boolean;
  /** Race role once check-in has fixed the composition (#69); null before. */
  raceRole: string | null;
  isReserve: boolean;
};

export async function EntryChecklist({
  members,
  locked,
}: {
  members: ChecklistMember[];
  /** The entry is checked in — the composition below is final. */
  locked: boolean;
}) {
  const t = await getTranslations("teams.entryPage");
  const confirmed = members.filter((member) => member.confirmed).length;

  return (
    <section
      className="iv-share"
      data-entry-checklist="1"
      data-entry-checklist-confirmed={`${confirmed}/${members.length}`}
      data-entry-locked={locked ? "1" : "0"}
    >
      <span className="iv-eyebrow">{t("checklistHeading")}</span>
      <p className="iv-share__hint">
        {t("confirmedSummary", { confirmed, total: members.length })}
      </p>

      {locked ? (
        <div className="banner banner--info" data-entry-locked-banner="1">
          <div className="banner__body">
            <div className="banner__txt">{t("lockedNotice")}</div>
          </div>
        </div>
      ) : null}

      <div className="reg-list">
        {members.map((member) => (
          <div
            key={member.userId}
            className="reg-card"
            data-entry-member={member.userId}
            data-entry-confirmed={member.confirmed ? "1" : "0"}
          >
            <div className="reg-card__body">
              <span className="reg-card__title">{member.displayName}</span>
              <div className="reg-card__meta">
                {member.raceRole ? <span>{t(`role.${member.raceRole}`)}</span> : null}
                {member.isReserve ? <span>{t("reserve")}</span> : null}
              </div>
            </div>
            <div className="reg-card__actions">
              <span
                className={`status ${member.confirmed ? "status--completed" : "status--registered"}`}
              >
                <span className="status__dot" />
                {member.confirmed ? t("confirmed") : t("awaiting")}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
