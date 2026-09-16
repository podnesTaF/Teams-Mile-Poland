import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";

import type { UserTeamRow } from "@/db/schema/user-teams";
import { Link } from "@/i18n/navigation";

import type { RosterSummary } from "../eligibility";
import { RosterCountTile } from "./roster-count-tile";

/**
 * The team card every visitor sees: name, region, category, the runner count,
 * description and the **captain's first name**.
 *
 * Deliberately carries no roster names — members never consented to being
 * listed publicly and no start list exists yet (PRD #57, "Public surfaces show
 * no roster names"). The roster is a separate component the page renders only
 * for members and admin.
 */
export async function TeamCard({
  team,
  roster,
  managerFirstName,
}: {
  team: UserTeamRow;
  roster: RosterSummary;
  managerFirstName: string | null;
}) {
  const t = await getTranslations("teams.page");
  const tForm = await getTranslations("teams.form");

  return (
    <section className="iv-card" data-team-card={team.slug}>
      <span className="iv-eyebrow">{t("eyebrow")}</span>
      <h1 className="iv-title">{team.name}</h1>

      <div className="pf-ref-stats">
        <div className="iv-info">
          <div className="iv-info__label">{t("category")}</div>
          <div className="iv-info__value">{tForm(`categoryOption.${team.category}`)}</div>
        </div>
        <div className="iv-info">
          <div className="iv-info__label">{t("region")}</div>
          <div className="iv-info__value">{team.region}</div>
        </div>
        <RosterCountTile roster={roster} showSplit={false} />
      </div>

      {team.description ? <p className="iv-sub">{team.description}</p> : null}

      <div className="team-card__foot">
        {managerFirstName ? <span>{t("managerIs", { name: managerFirstName })}</span> : null}
        {team.recruiting ? (
          <span className="status status--open">
            <span className="status__dot" />
            {t("recruitingOn")}
          </span>
        ) : null}
      </div>
    </section>
  );
}

/**
 * The same team, as a tile in a grid — what `/teams` lists (PRD #57, user
 * story 27).
 *
 * A second layout rather than a prop on {@link TeamCard} because the two are
 * different shapes: the card is a page hero (its own `<h1>`, full description,
 * info tiles) and the tile is one of many (an `<h2>` that links to the team,
 * a clamped description, a count line instead of a stat tile). What they
 * share is the part that matters — the *fields*: name, region, category, the
 * runner count, description, captain's first name, and **no roster names**.
 * Keep them in this one file so that guarantee stays reviewable in one place.
 *
 * `action` is a slot, not a hard-coded button: the list owns the call to action
 * ("Ask to join") because the list knows the visitor is a stranger, and a tile
 * elsewhere may want a different one — or none.
 */
export async function TeamTile({
  team,
  roster,
  managerFirstName,
  action,
}: {
  team: UserTeamRow;
  roster: RosterSummary;
  managerFirstName: string | null;
  action?: ReactNode;
}) {
  const t = await getTranslations("teams.page");
  const tForm = await getTranslations("teams.form");
  // The tile's one number is the roster count, shown plain: there is no target
  // and no cap to draw a meter against (ADR 0011).
  const { count } = roster;

  return (
    <article className="team-tile" data-team-card={team.slug}>
      <div className="team-tile__head">
        <span className="team-tile__mono" aria-hidden="true">
          {Array.from(team.name)[0] ?? "?"}
        </span>
        <div className="team-tile__ident">
          <h2 className="team-tile__name">
            <Link href={`/teams/${team.slug}`}>{team.name}</Link>
          </h2>
          <div className="team-tile__chips">
            <span className="team-chip">{tForm(`categoryOption.${team.category}`)}</span>
            <span className="team-chip team-chip--quiet">{team.region}</span>
          </div>
        </div>
      </div>

      <div className="team-tile__meter" data-team-roster-count={count}>
        <div className="team-tile__meter-head">
          <span className="team-tile__meter-label">{t("rosterCountLabel")}</span>
          <span className="team-tile__meter-value">{count}</span>
        </div>
      </div>

      {team.description ? <p className="team-tile__desc">{team.description}</p> : null}

      <div className="team-tile__foot">
        <span className="team-tile__captain">
          {managerFirstName ? t("managerIs", { name: managerFirstName }) : null}
        </span>
        {action}
      </div>
    </article>
  );
}
