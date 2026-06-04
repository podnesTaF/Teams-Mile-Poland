import Image from "next/image";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

import { FooterActions } from "./footer-actions";
import { Wordmark } from "./wordmark";

/** Closing CTA with a faded team photo, red prize-box, and the full ACE BATTLE footer. */
export function FinalCta() {
  const t = useTranslations("landing.finalCta");
  const f = useTranslations("landing.footer");
  const hero = useTranslations("landing.hero");

  return (
    <section className="section final" data-screen-label="Final CTA">
      <div className="final__photo">
        <Image src="/landing/fig/final-team.png" alt="" width={720} height={483} />
      </div>
      <div className="cta-box">
        <div className="cta-box__inner">
          <h2 className="head t-cta">{t("title")}</h2>
          <div className="stats">
            <Stat k={hero("stats.dateLabel")} v={hero("stats.dateValue")} />
            <Stat k={hero("stats.freeLabel")} v={hero("stats.freeValue")} />
            <Stat k={hero("stats.prizeLabel")} v={hero("stats.prizeValue")} />
            <Stat k={hero("stats.timeLabel")} v={hero("stats.timeValue")} />
          </div>
          <Link href="/register" className="btn btn-white">
            {t("cta")}
          </Link>
        </div>
      </div>
      <footer className="acl-footer" data-screen-label="Footer">
        <div className="acl-footer__glow" aria-hidden />
        <Image
          className="acl-footer__chev"
          src="/landing/icons/footer-chevrons.svg"
          alt=""
          width={1440}
          height={403}
          aria-hidden
        />
        <div className="acl-footer__inner">
          <Wordmark variant="foot" />
          <FooterActions
            phone={f("phone")}
            email={f("email")}
            shareLabel={f("share")}
            copiedLabel={f("shareCopied")}
          />
        </div>
      </footer>
    </section>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="stat">
      <span className="k">{k}</span>
      <span className="v">{v}</span>
    </div>
  );
}
