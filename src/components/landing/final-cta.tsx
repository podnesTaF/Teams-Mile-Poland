import Image from "next/image";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

import { Wordmark } from "./wordmark";

/** Closing CTA with a faded team photo, red prize-box, and the ACE BATTLE footer mark. */
export function FinalCta() {
  const t = useTranslations("landing.finalCta");
  const hero = useTranslations("landing.hero");

  return (
    <section className="section final" data-screen-label="Final CTA">
      <div className="final__photo">
        <Image src="/landing/team-cutout.png" alt="" width={720} height={500} />
      </div>
      <div className="cta-box">
        <div className="cta-box__inner">
          <h2 className="head t-cta">{t("title")}</h2>
          <div className="stats">
            <Stat k={hero("stats.dateLabel")}  v={hero("stats.dateValue")} />
            <Stat k={hero("stats.freeLabel")}  v={hero("stats.freeValue")} />
            <Stat k={hero("stats.prizeLabel")} v={hero("stats.prizeValue")} />
            <Stat k={hero("stats.timeLabel")}  v={hero("stats.timeValue")} />
          </div>
          <Link href="/register" className="btn btn-white">
            {t("cta")}
          </Link>
        </div>
      </div>
      <div className="acl-footer">
        <Wordmark variant="foot" />
      </div>
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
