import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { formatEventDayMonth } from "@/lib/events/time";

import { FooterActions } from "./footer-actions";
import { Wordmark } from "./wordmark";

/**
 * Closing CTA with a faded team photo, red prize-box, and the full ACE BATTLE
 * footer. `registrationOpen` mirrors the hero: when no event is taking
 * registrations the register button is demoted to a "registration is closed"
 * note pointing at the results.
 */
export function FinalCta({
  registrationOpen = false,
  nextEventDate,
  registerHref = "/register",
}: {
  registrationOpen?: boolean;
  /** ISO date of the featured event — drives the date stat, as in the hero. */
  nextEventDate?: string | null;
  /** Where "Register" leads — the events list for an individual featured
   * event, the legacy /register modal for a team one. See `LandingView`. */
  registerHref?: string;
}) {
  const t = useTranslations("landing.finalCta");
  const f = useTranslations("landing.footer");
  const hero = useTranslations("landing.hero");
  const locale = useLocale();

  return (
    <section className="section final" data-screen-label="Final CTA">
      <div className="final__photo">
        <Image src="/landing/fig/final-team.png" alt="" width={720} height={483} />
      </div>
      <div className="cta-box">
        <div className="cta-box__inner">
          <h2 className="head t-cta">
            {registrationOpen ? t("title") : hero("registrationClosed")}
          </h2>
          <div className="stats">
            {nextEventDate ? (
              <Stat k={hero("stats.dateLabel")} v={formatEventDayMonth(locale, nextEventDate)} />
            ) : null}
            <Stat k={hero("stats.freeLabel")} v={hero("stats.freeValue")} />
            <Stat k={hero("stats.prizeLabel")} v={hero("stats.prizeValue")} />
          </div>
          {registrationOpen ? (
            <Link href={registerHref} className="btn btn-white btn-white--ink">
              {t("cta")}
            </Link>
          ) : (
            <a href="#results" className="btn btn-white btn-white--ink">
              {hero("ctaResults")}
            </a>
          )}
        </div>
      </div>
      <footer className="acl-footer" data-screen-label="Footer">
        <Image
          className="acl-footer__glow"
          src="/vectors/ellipse.svg"
          alt=""
          width={1352}
          height={1096}
          aria-hidden
        />
        <Image
          className="acl-footer__chev acl-footer__chev--left"
          src="/vectors/Arrows%20right.svg"
          alt=""
          width={1097}
          height={643}
          aria-hidden
        />
        <Image
          className="acl-footer__chev acl-footer__chev--right"
          src="/vectors/Arrows%20left.svg"
          alt=""
          width={1097}
          height={643}
          aria-hidden
        />
        <div className="acl-footer__inner">
          <Wordmark variant="foot" />
          <p className="footer__sub">{f("sub")}</p>
          <FooterActions
            phone={f("phone")}
            email={f("email")}
            shareLabel={f("share")}
            copiedLabel={f("shareCopied")}
          />
          <nav className="footer__legal" aria-label={f("terms")}>
            <Link href="/terms">{f("terms")}</Link>
          </nav>
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
