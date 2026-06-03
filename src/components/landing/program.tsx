import { useTranslations } from "next-intl";

const TIMELINE = [
  "registration",
  "briefing",
  "startGames",
  "main",
  "finish",
  "awards",
] as const;

const ALSO = [
  { id: "photo", tile: "tile-camera" },
  { id: "gifts", tile: "tile-gift" },
  { id: "people", tile: "tile-friend" },
] as const;

/** "Program of the day" — left timeline column, right "and also" sidebar. */
export function Program() {
  const t = useTranslations("landing.program");

  return (
    <section className="section" data-screen-label="Program">
      <div className="wrap">
        <div className="center stack" style={{ gap: 10 }}>
          <h2 className="head t-sec">{t("title")}</h2>
          <p className="head t-20" style={{ opacity: 0.6 }}>
            {t("hours")}
          </p>
        </div>
        <div className="prog-grid">
          <div className="timeline">
            {TIMELINE.map((id) => (
              <div key={id} className="trow">
                <span className="time">{t(`timeline.${id}.time`)}</span>
                <div>
                  <h3 className="t-t">{t(`timeline.${id}.title`)}</h3>
                  <p className="sm">{t(`timeline.${id}.body`)}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="also">
            <span className="also__h">{t("alsoLabel")}</span>
            {ALSO.map(({ id, tile }) => (
              <div key={id} className="arow">
                <span
                  className="em"
                  style={{ backgroundImage: `url(/landing/icons/${tile}.svg)` }}
                  aria-hidden
                />
                <div>
                  <h3 className="a-t">{t(`also.${id}.title`)}</h3>
                  <p className="body">{t(`also.${id}.body`)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
