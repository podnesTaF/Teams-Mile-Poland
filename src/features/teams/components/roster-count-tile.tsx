import { getTranslations } from "next-intl/server";

import type { RosterSummary } from "../eligibility";

/**
 * The roster as a number — "Runners · 9" — plus the men/women split on a mixed
 * team. A plain count, never "x of N": a roster has no target and no cap (ADR
 * 0011), so there is nothing to measure it against.
 */
export async function RosterCountTile({
  roster,
  showSplit = true,
}: {
  roster: RosterSummary;
  /** Off on the public card, where the split is not part of the summary. */
  showSplit?: boolean;
}) {
  const t = await getTranslations("teams.page");
  const { count, men, women, category } = roster;

  return (
    <div className="iv-info" data-team-roster-count={count}>
      <div className="iv-info__label">{t("rosterCountLabel")}</div>
      <div className="iv-info__value">{count}</div>
      {showSplit && category === "mixed" ? (
        <div className="iv-share__hint" data-team-split={`${men}-${women}`}>
          {t("rosterSplit", { men, women })}
        </div>
      ) : null}
    </div>
  );
}
