import Image from "next/image";
import { useTranslations } from "next-intl";

const CARDS = [
  { id: "roles",  src: "/landing/card-roles.png"  },
  { id: "team",   src: "/landing/card-team.png"   },
  { id: "rating", src: "/landing/card-rating.png" },
] as const;

/** "What is ACE BATTLE RUN?" — three image cards with red→ink triangle behind. */
export function WhatIs() {
  const t = useTranslations("landing.whatIs");

  return (
    <section className="section whatis" data-screen-label="What is">
      <div className="wrap">
        <h2 className="head t-hero center">{t("title")}</h2>
        <div className="cards-wrap">
          <Image
            className="tri-up"
            src="/landing/arrow.png"
            alt=""
            width={1440}
            height={478}
            aria-hidden
          />
          <div className="cards3">
            {CARDS.map((card) => (
              <article key={card.id} className="icard">
                <Image
                  className="icard__img"
                  src={card.src}
                  alt={t(`cards.${card.id}.alt`)}
                  width={305}
                  height={255}
                />
                <div className="icard__body">
                  <h3 className="head t-24 red">{t(`cards.${card.id}.title`)}</h3>
                  {t(`cards.${card.id}.body`) ? (
                    <p className="body">{t(`cards.${card.id}.body`)}</p>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
