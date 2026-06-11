import Image from "next/image";
import { useTranslations } from "next-intl";

/** Audience items → masked SVG icon file (recoloured white via CSS mask). */
const ITEMS = [
  { id: "runners", icon: "ic-run" },
  { id: "fitness", icon: "ic-fitness" },
  { id: "corporate", icon: "group" },
  { id: "clubs", icon: "running-clubs" },
  { id: "athletes", icon: "ic-athlete" },
  { id: "mix", icon: "ic-mix" },
] as const;

function maskStyle(icon: string) {
  const url = `url(/landing/icons/${icon}.svg)`;
  return { WebkitMaskImage: url, maskImage: url } as React.CSSProperties;
}

/** Red bleed-edge box with the 6 audience icons, plus the "and of course" support band underneath on the dark background. */
export function Audience() {
  const t = useTranslations("landing.audience");

  return (
    <section className="section audience" data-screen-label="Audience">
      <div className="audience-box">
        <div className="wrap center">
          <h2 className="head t-sec">{t("title")}</h2>
          <div className="aud-grid">
            {ITEMS.map(({ id, icon }) => (
              <div key={id} className="aud">
                <span className="aud__ic" style={maskStyle(icon)} aria-hidden />
                <span className="aud__t">{t(`items.${id}.label`)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="wrap support-wrap">
        <Image
          className="support-glow"
          src="/vectors/ellipse.svg"
          alt=""
          width={1352}
          height={1096}
          aria-hidden
        />
        <div className="support-band">
          <span className="support-band__ic" style={maskStyle("ic-corporate")} aria-hidden />
          <div className="support-band__txt">
            <span className="support-band__kicker">{t("support.kicker")}</span>
            <span className="support-band__title">{t("support.title")}</span>
            <span className="support-band__sub">
              {t.rich("support.sub", {
                hot: (chunks) => <span className="red">{chunks}</span>,
              })}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
