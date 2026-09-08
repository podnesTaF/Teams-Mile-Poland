import { getTranslations } from "next-intl/server";

import type { UserTeamRow } from "@/db/schema/user-teams";
import { localePath } from "@/lib/i18n/config";

import { InvitationsPanel } from "./invitations-panel";
import { JoinRequestQueue } from "./join-request-queue";
import { RotateCodeButton } from "./rotate-code-button";
import { TeamForm } from "./team-form";

/**
 * The manager view's third layer: edit the team, rotate the code, switch
 * recruiting on and off (the recruiting checkbox inside the form *is* the
 * toggle — one field, one write).
 *
 * This is also where the two later slices plug in. They add one render line
 * each at the marked slots and their own component file; nothing in here
 * changes.
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
      <h2 className="iv-title pf-h2">{t("manageHeading")}</h2>

      {/* SLOT — #60 invitations panel (invite by email, resend, revoke). */}
      <InvitationsPanel team={team} locale={locale} />


      {/* SLOT — #61 join-request queue (pending requests, accept / decline). */}
      <JoinRequestQueue slug={team.slug} locale={locale} />

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

      <p className="iv-share__hint">{t("rotateHint")}</p>
      <RotateCodeButton slug={team.slug} />
    </section>
  );
}
