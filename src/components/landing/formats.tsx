import Image from "next/image";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

import { DuoIcon, SoloIcon } from "./icons";

/**
 * Two big cards for the "Format of participation" section.
 * `noTeam` → /register/solo (quick-register modal).
 * `hasTeam` → /register/team (create-team modal).
 */
export function Formats() {
  const t = useTranslations("landing.formats");

  return (
    <section className="section" data-screen-label="Formats">
      <div className="wrap center">
        <h2 className="head t-sec">{t("title")}</h2>
        <div className="formats">
          <article className="fcard">
            <div className="fcard__head fcard__head--red">
              <span className="fcard__ic">
                <SoloIcon />
              </span>
              <Image src="/landing/solo-athlete.png" alt={t("noTeam.alt")} fill sizes="430px" />
            </div>
            <div className="fcard__body">
              <h3 className="head t-24">{t("noTeam.title")}</h3>
              <p className="sm">{t("noTeam.body")}</p>
              <Link href="/register/solo" className="btn btn-red btn-block">
                {t("noTeam.cta")}
              </Link>
            </div>
          </article>
          <article className="fcard">
            <div className="fcard__head fcard__head--dark">
              <span className="fcard__ic">
                <DuoIcon />
              </span>
              <Image src="/landing/team-cutout.png" alt={t("hasTeam.alt")} fill sizes="430px" />
            </div>
            <div className="fcard__body">
              <h3 className="head t-32">{t("hasTeam.title")}</h3>
              <p className="sm">{t("hasTeam.body")}</p>
              <Link href="/register/team" className="btn btn-red btn-block">
                {t("hasTeam.cta")}
              </Link>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
