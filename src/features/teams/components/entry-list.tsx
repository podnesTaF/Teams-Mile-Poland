import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";

import type { EntrySummary } from "../entries";

/**
 * The team page's **Entries** list (PRD #64, user story 3's other half): every
 * event this team has entered, with how many members have confirmed.
 *
 * A server component, not an island: nothing here is interactive. Each row is a
 * link into the entry page, which is where the captain's controls live — the
 * team page stays a summary and does not grow a second copy of them.
 *
 * Shown to members as well as the captain. A member wants to know who else has
 * confirmed (user story 26), and the count is the answer without naming
 * anybody.
 */
export async function EntryList({
  teamSlug,
  entries,
  eventNames,
}: {
  teamSlug: string;
  entries: EntrySummary[];
  /** `event_slug → event name`, resolved by the page (this component reads nothing). */
  eventNames: Record<string, string>;
}) {
  if (entries.length === 0) return null;

  const t = await getTranslations("teams.entry");

  return (
    <section
      className="regs-section pf-section"
      id="entries"
      data-entry-list="1"
      data-entry-count={entries.length}
    >
      <div className="section-label">
        <span className="iv-eyebrow">{t("listHeading")}</span>
      </div>

      <div className="reg-list">
        {entries.map(({ entry, total, confirmed }) => (
          <div
            key={entry.id}
            className="reg-card reg-card--plain"
            data-entry-row={entry.eventSlug}
            data-entry-status={entry.status}
          >
            <div className="reg-card__body">
              <span className="reg-card__title">
                {eventNames[entry.eventSlug] ?? entry.eventSlug}
              </span>
              <div className="reg-card__meta">
                <span data-entry-confirmed-count={`${confirmed}/${total}`}>
                  {t("confirmedOf", { confirmed, total })}
                </span>
                <span>{t(`status.${entry.status}`)}</span>
              </div>
            </div>
            <div className="reg-card__actions">
              <Link
                className="btn btn-sm btn-stroke-dark"
                href={`/teams/${teamSlug}/entries/${entry.eventSlug}`}
              >
                {t("openEntry")}
              </Link>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
