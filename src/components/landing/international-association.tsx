import Image from "next/image";
import { useTranslations } from "next-intl";

const ABA_URL = "https://aba.run";

/** Licensed-event band linking to the international Ace Battle Association. */
export function InternationalAssociation() {
  const t = useTranslations("landing.internationalAssociation");

  return (
    <section
      className="section aba-assoc"
      id="association"
      data-screen-label="International Association"
    >
      <Image
        className="sect-glow sect-glow--right"
        src="/landing/icons/roles-glow.svg"
        alt=""
        width={1352}
        height={1096}
        aria-hidden
      />
      <div className="wrap">
        <div className="aba-panel">
          <a
            className="aba-panel__logo"
            href={ABA_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t("logoAriaLabel")}
          >
            <Image
              src="/brand/aba-white.svg"
              alt={t("logoAlt")}
              width={606}
              height={124}
              priority={false}
            />
          </a>
          <div className="aba-panel__copy">
            <span className="aba-panel__eyebrow">{t("eyebrow")}</span>
            <h2 className="head t-sec">{t("title")}</h2>
            <p className="lead">{t("body")}</p>
            <a
              className="btn btn-stroke"
              href={ABA_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("cta")}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
