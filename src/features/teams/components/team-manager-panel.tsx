import { getTranslations } from "next-intl/server";

import type { UserTeamRow } from "@/db/schema/user-teams";
import { localePath } from "@/lib/i18n/config";

import { InvitationsPanel } from "./invitations-panel";
import { JoinRequestQueue } from "./join-request-queue";
import { RotateCodeButton } from "./rotate-code-button";
import { TeamForm } from "./team-form";

/**
 * The captain view's third layer, in reading order: bring runners in
 * (invitations, then the join-request queue), then the team's own settings
 * (the edit form — its recruiting choice *is* the toggle, one field, one
 * write), then the team code (rotate a leaked one).
 *
 * One `Manage` section label at the top; each block below carries its own
 * heading, so nothing reads as a heading without a body.
 */
export async function TeamManagerPanel({
  team,
  locale,
}: {
  team: UserTeamRow;
  locale: string;
}) {
  const t = await getTranslations("teams.page");

  return (
    <section className="regs-section pf-section" id="manage">
      <div className="section-label">
        <span className="iv-eyebrow">{t("manageTitle")}</span>
      </div>

      {/* #60 invitations panel (invite by email, resend, revoke). */}
      <InvitationsPanel team={team} locale={locale} />

      {/* #61 join-request queue (pending requests, accept / decline). */}
      <JoinRequestQueue slug={team.slug} locale={locale} />

      <div className="pf-block" id="settings">
        <h2 className="iv-title pf-h2">{t("manageHeading")}</h2>
        <TeamForm
          mode="edit"
          slug={team.slug}
          initial={{
            name: team.name,
            region: team.region,
            category: team.category,
            recruiting: team.recruiting,
            description: team.description ?? "",
          }}
          rulesHref={localePath(locale, "/legal/team-rules")}
        />
      </div>

      <div className="pf-block" id="code">
        <h2 className="iv-title pf-h2">{t("codeHeading")}</h2>
        <div className="team-codebox">
          <p className="team-codebox__hint">
            {t("codeLabel")} <b data-team-code={team.code}>{team.code}</b> · {t("rotateHint")}
          </p>
          <RotateCodeButton slug={team.slug} />
        </div>
      </div>
    </section>
  );
}
