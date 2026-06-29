import Image from "next/image";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

import { LangPill } from "./lang-pill";
import { PinIcon, ScrollArrowIcon } from "./icons";
import { VideoPlay } from "./video-play";
import { Wordmark } from "./wordmark";

const HOW_IT_WAS_VIDEO_ID = "CxTwKZNy5lE";

/** Quick-nav chips shown in the hero. `results` is included only when results exist. */
const QUICK_NAV = [
  { key: "results", href: "#results", resultsOnly: true },
  { key: "whatIs", href: "#what-is" },
  { key: "program", href: "#program" },
  { key: "location", href: "#location" },
  { key: "faq", href: "#faq" },
] as const;

/**
 * Hero + format-band combined (the design's `<header class="hero">` element).
 *
 * The atmosphere background sits behind a black-→ink vertical gradient,
 * then the page transitions into the "Format Poland has never seen" red-blob
 * band with the athlete cutout.
 *
 * `registrationOpen` drives the primary CTA: when a featured event is taking
 * registrations it links to `/register`; otherwise the primary action points
 * at the results and registration is demoted to a quiet "closed" note.
 */
export function Hero({
  registrationOpen,
  hasResults,
}: {
  registrationOpen: boolean;
  hasResults: boolean;
}) {
  const t = useTranslations("landing.hero");
  const fb = useTranslations("landing.formatBand");

  const quickNav = QUICK_NAV.filter((item) => !("resultsOnly" in item) || hasResults);

  return (
    <header className="hero" data-screen-label="Hero">
      <div className="hero__bg" />
      <div className="hero__inner">
        <div className="wrap">
          <nav className="nav">
            <Wordmark variant="nav" />
            <LangPill />
          </nav>

          <div className="hero__content">
            <p className="hero__kicker">
              <Image src="/landing/icons/foot.svg" alt="" width={30} height={30} aria-hidden />
              <span>{t("kicker")}</span>
            </p>
            <h1 className="head t-hero hero__title">
              {t.rich("title", {
                br: () => <br />,
                red: (chunks) => <span className="red">{chunks}</span>,
              })}
            </h1>
            <p className="lead hero__sub">{t("sub")}</p>
            <div className="hero__actions">
              {registrationOpen ? (
                <Link href="/register" className="btn btn-red">
                  {t("ctaPrimary")}
                </Link>
              ) : (
                <a href="#results" className="btn btn-red">
                  {t("ctaResults")}
                </a>
              )}
              <a href="#contact" className="btn btn-stroke">
                {t("ctaSecondary")}
              </a>
            </div>
            {!registrationOpen && <p className="hero__reg-note">{t("registrationClosed")}</p>}
            {quickNav.length > 0 && (
              <nav className="hero__quicknav" aria-label={t("quickNavLabel")}>
                {quickNav.map(({ key, href }) => (
                  <a key={key} href={href} className="hero__chip">
                    {t(`quickNav.${key}`)}
                  </a>
                ))}
              </nav>
            )}
            <div className="stats">
              <Stat k={t("stats.dateLabel")} v={t("stats.dateValue")} />
              <Stat k={t("stats.freeLabel")} v={t("stats.freeValue")} />
              <Stat k={t("stats.prizeLabel")} v={t("stats.prizeValue")} />
              <Stat k={t("stats.maxParticipantsLabel")} v={t("stats.maxParticipantsValue")} />
            </div>
            <div className="pin">
              <PinIcon />
              <span>{t("venue")}</span>
            </div>
            <ScrollArrowIcon className="scroll-arrow" />
          </div>
        </div>

        <div className="formatband">
          <div className="format-grad" aria-hidden />
          <div className="format-stage">
            <Wordmark variant="mark" />
            {/* Stacking, back → front: card (1) · athlete (2) · veil (3) · text (4).
                The card carries no z-index / transform so it isn't a stacking
                context — that lets its own text rise above the athlete + veil
                via .format-card__text { z-index: 4 } while the athlete still
                overlays the card panel itself. */}
            <div className="format-card">
              <div className="format-card__text">
                <h2 className="head t-32">{fb("title")}</h2>
                <h3 className="head t-24">{fb("subtitle")}</h3>
                <p className="body">{fb("body")}</p>
              </div>
            </div>
            <Image
              className="format-athlete"
              src="/landing/athlete.png"
              alt=""
              width={500}
              height={750}
              priority={false}
            />
            <div className="format-veil" aria-hidden />
          </div>
          <VideoPlay label={fb("playLabel")} videoId={HOW_IT_WAS_VIDEO_ID} />
        </div>
      </div>
    </header>
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
