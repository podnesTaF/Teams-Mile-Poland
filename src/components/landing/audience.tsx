import { useTranslations } from "next-intl";

const ITEMS = ["runners", "fitness", "corporate", "clubs", "curious"] as const;

/** Red bleed-edge box with the 5 audience icons, plus the "and of course" row underneath on the dark background. */
export function Audience() {
  const t = useTranslations("landing.audience");

  return (
    <section className="section audience" data-screen-label="Audience">
      <div className="audience-box">
        <div className="wrap center">
          <h2 className="head t-sec">{t("title")}</h2>
          <div className="aud-grid">
            {ITEMS.map((id) => (
              <div key={id} className="aud">
                <span className="aud__ic">{t(`items.${id}.icon`)}</span>
                <span className="aud__t">{t(`items.${id}.label`)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="wrap">
        <div className="aud-extra">
          <span className="faint">{t("extraFaint")}</span>
          <span>{t("extraIcon")}</span>
          <span>{t("extraText")}</span>
        </div>
      </div>
    </section>
  );
}
