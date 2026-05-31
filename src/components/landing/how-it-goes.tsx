import { useTranslations } from "next-intl";

const STEPS = ["one", "two", "three", "four"] as const;

/** White section: 4 numbered steps explaining how the game runs. */
export function HowItGoes() {
  const t = useTranslations("landing.howItGoes");

  return (
    <section className="section light" data-screen-label="How it goes">
      <div className="wrap center">
        <h2 className="head t-40 upper">{t("title")}</h2>
        <div className="steps">
          {STEPS.map((id, idx) => (
            <div key={id} className="step">
              <span className="step__n">{idx + 1}</span>
              <span className="step__t">{t(`steps.${id}.title`)}</span>
              <p className="body">{t(`steps.${id}.body`)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
