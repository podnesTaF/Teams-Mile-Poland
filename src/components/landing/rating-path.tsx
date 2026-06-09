import Image from "next/image";
import { useTranslations } from "next-intl";

import { PrizeFundCta } from "./prize-fund-cta";

/**
 * "РЕЙТИНГ — ЦЕ ШЛЯХ ДО ПРИЗОВОГО ФОНДУ" — red-gradient band with the
 * winning-team photo + heading, the autumn National-League banner, and the
 * two prize-fund buttons (rendered by the client {@link PrizeFundCta}, which
 * also owns the standard prize-table modal). Sits between WhatIs and HowItGoes.
 */
export function RatingPath() {
  const t = useTranslations("landing.ratingPath");

  return (
    <section className="section ratingpath" data-screen-label="Rating path">
      <div className="rp-red">
        <div className="wrap">
          <div className="rp-top">
            <div className="rp-photo">
              <span className="rp-photo__chev" aria-hidden />
              <Image
                src="/landing/fig/prize-team.png"
                alt={t("photoAlt")}
                width={451}
                height={231}
              />
            </div>
            <div className="rp-copy">
              <h2 className="head t-40">{t("title")}</h2>
              <p className="lead">{t("lead")}</p>
            </div>
          </div>
          <div className="rp-banner">
            <span className="rp-banner__cal" aria-hidden />
            <p className="head t-20 rp-banner__h">{t("bannerHeading")}</p>
            <p className="rp-banner__sub">{t("bannerSub")}</p>
          </div>
        </div>
        {/* ink chevron pointing up into the red band from the dark CTA below */}
        <span className="rp-arrow" aria-hidden />
      </div>
      <div className="wrap">
        <PrizeFundCta />
      </div>
      {/* seam chevron overhanging down into the white HowItGoes section */}
      <span className="rp-arrow rp-arrow--bottom" aria-hidden />
    </section>
  );
}
