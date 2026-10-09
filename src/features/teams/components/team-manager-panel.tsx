import { getTranslations } from "next-intl/server";

import type { UserTeamRow } from "@/db/schema/user-teams";
import { localePath } from "@/lib/i18n/config";

import { isPlacementTeamSlug } from "../config";
import { InvitationsPanel } from "./invitations-panel";
import { TeamForm } from "./team-form";

/**
 * The captain view's third layer, in reading order: bring runners in
 * (invitations — on a placement team only, the only teams that take new
 * members, ADR 0016), then the team's own settings (the edit form). Join
 * requests and the team code are closed, so neither the queue nor the code
 * block renders any more.
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
      {isPlacementTeamSlug(team.slug) ? <InvitationsPanel team={team} locale={locale} /> : null}

      <div className="pf-block" id="settings">
        <h2 className="iv-title pf-h2">{t("manageHeading")}</h2>
        <TeamForm
          slug={team.slug}
          initial={{
            name: team.name,
            region: team.region,
            recruiting: team.recruiting,
            description: team.description ?? "",
          }}
          rulesHref={localePath(locale, "/legal/team-rules")}
        />
      </div>
    </section>
  );
}
