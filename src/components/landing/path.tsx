import { useTranslations } from "next-intl";

const STEPS = ["one", "two", "three", "four"] as const;

/** "Your path forward" — 4 red-dot nodes connected by a dashed line, plus the closing manifesto under a flag. */
export function PathForward() {
  const t = useTranslations("landing.path");

  return (
    <section className="section path" data-screen-label="Path">
      <div className="wrap center">
        <h2 className="head t-sec">{t("title")}</h2>
        <div className="path-grid">
          {STEPS.map((id) => (
            <div key={id} className="pcard">
              <span className="pnode" />
              <h3 className="pcard__t">{t(`steps.${id}.title`)}</h3>
              <p>{t(`steps.${id}.body`)}</p>
            </div>
          ))}
        </div>
        <div className="path-foot">
          <span className="flag">{t("flag")}</span>
          <p className="lead">{t("foot")}</p>
        </div>
      </div>
    </section>
  );
}
