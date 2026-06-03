import Image from "next/image";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

import { Wordmark } from "./wordmark";

/** Footer social links → masked SVG icon (recoloured red via CSS `--ic`). */
const SOCIALS = [
  {
    id: "whatsapp",
    label: "WhatsApp",
    icon: "social-whatsapp",
    href: "https://chat.whatsapp.com/KynzdMczMoPE7Trr3CWGNH?mode=gi_t",
  },
  {
    id: "instagram",
    label: "Instagram",
    icon: "social-instagram",
    href: "https://www.instagram.com/acebattle_run/",
  },
  {
    id: "telegram",
    label: "Telegram",
    icon: "social-telegram",
    href: "https://t.me/acebattlerun",
  },
] as const;

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
          <span className="footer__sub">{f("sub")}</span>
          <div className="socials">
            {SOCIALS.map((s) => (
              <a
                key={s.id}
                className="social"
                href={s.href}
                aria-label={s.label}
                target="_blank"
                rel="noopener noreferrer"
                style={{ "--ic": `url(/landing/icons/${s.icon}.svg)` } as React.CSSProperties}
              />
            ))}
          </div>
          <div className="footer-contact">
            <a className="footer-phone" href={`tel:${f("phone").replace(/[^+\d]/g, "")}`}>
              {f("phone")}
            </a>
            <a className="footer-phone" href={`mailto:${f("email")}`}>
              {f("email")}
            </a>
          </div>
          <Link href="/" className="btn btn-stroke footer-share">
            {f("share")}
          </Link>
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
