import Image from "next/image";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

/** Chip → vector icon file in /vectors/chips. */
const CHIPS = [
  { id: "one", icon: "Icons" },
  { id: "two", icon: "Icons-1" },
  { id: "three", icon: "Icons-2" },
] as const;

/** White interlude: chips + headline + CTA. */
export function Invite() {
  const t = useTranslations("landing.invite");

  return (
    <section className="section" data-screen-label="Invite">
      <div className="wrap invite">
        <div className="chips">
          {CHIPS.map(({ id, icon }) => (
            <span key={id} className="chip">
              <Image
                className="chip__ic"
                src={`/vectors/chips/${icon}.svg`}
                alt=""
                width={24}
                height={24}
                aria-hidden
              />
              {t(`chips.${id}`)}
            </span>
          ))}
        </div>
        <h2 className="head t-sec">{t("title")}</h2>
        <Link href="/register" className="btn btn-red">
          {t("cta")}
        </Link>
      </div>
    </section>
  );
}
