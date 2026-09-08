import { getTranslations } from "next-intl/server";

import type { TeamCompleteness } from "../eligibility";

/**
 * "7 of 7 — complete" / "5 of 8 — 3 more needed", plus the men/women split on a
 * mixed team. Read from `TEAM_LIMITS` at render time and never stored.
 */
export async function TeamCompletenessTile({
  completeness,
  showSplit = true,
}: {
  completeness: TeamCompleteness;
  /** Off on the public card, where the split is not part of the summary. */
  showSplit?: boolean;
}) {
  const t = await getTranslations("teams.page");
  const { count, min, missing, complete, men, women, minPerSex } = completeness;

  return (
    <div className="iv-info" data-team-completeness={complete ? "complete" : "incomplete"}>
      <div className="iv-info__label">{t("completenessLabel")}</div>
      <div className="iv-info__value">
        {complete
          ? t("completenessComplete", { count, min })
          : t("completenessNeeded", { count, min, missing })}
      </div>
      {showSplit && minPerSex !== null ? (
        <div className="iv-share__hint" data-team-split={`${men}-${women}`}>
          {t("completenessSplit", { men, women, minPerSex })}
        </div>
      ) : null}
    </div>
  );
}
