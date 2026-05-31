import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

/** White interlude: chips + headline + CTA. */
export function Invite() {
  const t = useTranslations("landing.invite");

  return (
    <section className="section light" style={{ paddingTop: 0 }} data-screen-label="Invite">
      <div className="wrap invite">
        <div className="chips">
          <span className="chip">{t("chips.one")}</span>
          <span className="chip">{t("chips.two")}</span>
          <span className="chip">{t("chips.three")}</span>
        </div>
        <h2 className="head t-sec">{t("title")}</h2>
        <Link href="/register" className="btn btn-red">
          {t("cta")}
        </Link>
      </div>
    </section>
  );
}
