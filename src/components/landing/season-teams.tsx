import { useTranslations } from "next-intl";
import { Fragment } from "react";

/**
 * The two season teams as the hero presents them (design "Hero Season v2",
 * team strip). The roster lives in the DB (`PLACEMENT_TEAM_SLUGS`, ADR 0016),
 * but what this strip prints — the colour, who runs the team, the WhatsApp
 * group that forms it — is organiser copy, not account data: the race-side
 * captain is not modelled at all, and the manager's display name is whatever
 * case they typed at sign-up. So it is declared here, next to the markup.
 */
const TEAMS = [
  {
    key: "red",
    manager: "Iurii Pidnebesnyi",
    captain: "Robert Celiński",
    whatsapp: "https://chat.whatsapp.com/ICVJQniq4Bz2qvn4g57qyR",
    ctaClass: "btn btn-white",
  },
  {
    key: "black",
    manager: "Vitalii Bikhunov",
    captain: "Vitalii Naiko",
    whatsapp: "https://chat.whatsapp.com/IUnxDF9KnLeGzOvtajAs55",
    ctaClass: "btn btn-stroke",
  },
] as const;

/** Team strip under the season hero: the RED / BLACK cards and the three steps. */
export function SeasonTeams() {
  const t = useTranslations("landing.seasonTeams");

  return (
    <section id="teams" className="st" data-screen-label="Season teams">
      <div className="st__head">
        <p className="st__kicker">
          <span className="st__d">{t("kickerDesktop")}</span>
          <span className="st__m">{t("kicker")}</span>
        </p>
        <h2 className="head st__title">{t("title")}</h2>
        <p className="st__meta">{t("meta")}</p>
      </div>

      <div className="st__grid">
        {TEAMS.map((team, i) => (
          <Fragment key={team.key}>
            {i > 0 && (
              <div className="st__vs" aria-hidden>
                <span className="st__vs-line" />
                <span className="st__vs-badge">{t("vs")}</span>
                <span className="st__vs-line" />
              </div>
            )}
            <article className={`st__card st__card--${team.key}`}>
              <span className="st__wm" aria-hidden>
                {t(`${team.key}.watermark`)}
              </span>
              <div className="st__heading">
                <span className="st__tag">{t(`${team.key}.tag`)}</span>
                <span className="st__name">{t(`${team.key}.name`)}</span>
              </div>
              <dl className="st__names">
                <div className="st__person">
                  <dt className="st__role">{t("manager")}</dt>
                  <dd>{team.manager}</dd>
                </div>
                <div className="st__person">
                  <dt className="st__role">{t("captain")}</dt>
                  <dd>{team.captain}</dd>
                </div>
              </dl>
              <a
                className={`${team.ctaClass} st__cta`}
                href={team.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t(`${team.key}.cta`)}
              </a>
            </article>
          </Fragment>
        ))}
      </div>

      <ol className="st__steps">
        {(["1", "2", "3"] as const).map((n) => (
          <li key={n} className="st__step">
            <span className="st__num" aria-hidden>
              0{n}
            </span>
            <span className="st__step-text">
              <span className="st__step-t">{t(`steps.${n}.title`)}</span>
              <span className="st__step-s">{t(`steps.${n}.sub`)}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
