import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";

import { HashLink } from "@/components/ui/hash-link";
import { formatEventDayMonth } from "@/lib/events/time";

import { PinIcon, ScrollArrowIcon } from "./icons";
import { VideoPlay } from "./video-play";

const HOW_IT_WAS_VIDEO_ID = "CxTwKZNy5lE";

/** Quick-nav chips shown in the hero. `results` is included only when results exist. */
const QUICK_NAV = [
  { key: "results", href: "#results", resultsOnly: true },
  { key: "events", href: "#events" },
  { key: "whatIs", href: "#what-is" },
  // { key: "program", href: "#program" },
  { key: "location", href: "#location" },
  { key: "faq", href: "#faq" },
] as const;

/**
 * Hero + format-band combined (the design's `<header class="hero">` element).
 *
 * The atmosphere background sits behind a black-→ink vertical gradient,
 * then the page transitions into the format band: the ACE BATTLE watermark
 * behind a red pill with the track photo showing through it and the runners
 * cutout over the top, with the copy over the pill's lower half.
 *
 * `registrationOpen` drives the primary CTA: when a featured event is taking
 * registrations it links to `/register`; otherwise the primary action points
 * at the results and registration is demoted to a quiet "closed" note.
 */
export function Hero({
  registrationOpen,
  hasResults,
  registerHref = "/register",
  nextEventDate,
}: {
  registrationOpen: boolean;
  hasResults: boolean;
  registerHref?: string;
  /** ISO date of the featured event — drives the "Next event" stat. */
  nextEventDate?: string | null;
}) {
  const t = useTranslations("landing.hero");
  const fb = useTranslations("landing.formatBand");
  const locale = useLocale();

  const quickNav = QUICK_NAV.filter((item) => !("resultsOnly" in item) || hasResults);

  return (
    <header className="hero" data-screen-label="Hero">
      <div className="hero__bg" />
      <div className="hero__inner">
        <div className="wrap">
          {/* Top nav lives in the fixed <LandingHeader/>, transparent over the hero. */}
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
                <HashLink href={registerHref} className="btn btn-red">
                  {t("ctaPrimary")}
                </HashLink>
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
              {nextEventDate ? (
                <Stat k={t("stats.dateLabel")} v={formatEventDayMonth(locale, nextEventDate)} />
              ) : null}
              <Stat k={t("stats.freeLabel")} v={t("stats.freeValue")} />
              <Stat k={t("stats.prizeLabel")} v={t("stats.prizeValue")} />
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
            {/* Artwork layer — ratio-locked to the artboard's 1280×548 stage so
                every pinned child below can use artboard percentages directly.
                Stacking, back → front: wordmark (0) · mark fade (1) · photo
                group (2) · veil (3); the copy that follows sits at 4. */}
            <div className="format-art" aria-hidden>
              <div className="format-mark">ACE BATTLE</div>
              <div className="format-mark-fade" />
              <div className="format-photo">
                {/* Clipped 925×440 crop: red pill with the track photo showing
                    through it, then the runners cutout over the whole group. */}
                <div className="format-photo__inner">
                  <div className="format-pill">
                    <div className="format-pill__track" />
                  </div>
                  <div className="format-runners" />
                </div>
                {/* Sinks the pill's lower half into the ink so the copy reads. */}
                <div className="format-veil" />
              </div>
            </div>
            <div className="format-copy">
              <h2 className="head format-copy__title">{fb.rich("title", { br: () => <br /> })}</h2>
              <h3 className="head t-24">{fb("subtitle")}</h3>
              <p className="body format-copy__body">{fb("body")}</p>
              <VideoPlay label={fb("playLabel")} videoId={HOW_IT_WAS_VIDEO_ID} variant="row" />
            </div>
          </div>
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
