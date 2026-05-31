import Image from "next/image";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

import { LangPill } from "./lang-pill";
import { PinIcon, ScrollArrowIcon } from "./icons";
import { VideoPlay } from "./video-play";
import { Wordmark } from "./wordmark";

const HOW_IT_WAS_VIDEO_ID = "CxTwKZNy5lE";

/**
 * Hero + format-band combined (the design's `<header class="hero">` element).
 *
 * The atmosphere background sits behind a black-→ink vertical gradient,
 * then the page transitions into the "Format Poland has never seen" red-blob
 * band with the athlete cutout.
 */
export function Hero() {
  const t = useTranslations("landing.hero");
  const fb = useTranslations("landing.formatBand");

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
            <h1 className="head t-hero hero__title">
              {t.rich("title", { br: () => <br /> })}
            </h1>
            <p className="lead hero__sub">{t("sub")}</p>
            <div className="hero__actions">
              <Link href="/register" className="btn btn-red">
                {t("ctaPrimary")}
              </Link>
              <a href="#contact" className="btn btn-stroke">
                {t("ctaSecondary")}
              </a>
            </div>
            <div className="stats">
              <Stat k={t("stats.dateLabel")}  v={t("stats.dateValue")} />
              <Stat k={t("stats.freeLabel")}  v={t("stats.freeValue")} />
              <Stat k={t("stats.prizeLabel")} v={t("stats.prizeValue")} />
              <Stat k={t("stats.timeLabel")}  v={t("stats.timeValue")} />
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
