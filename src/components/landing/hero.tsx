import { getImageProps } from "next/image";
import { useTranslations } from "next-intl";

import { HashLink } from "@/components/ui/hash-link";
import { Link } from "@/i18n/navigation";
import type { SeasonStrip } from "@/lib/events/season-strip";

import { SeasonTeams } from "./season-teams";
import { VideoPlay } from "./video-play";

const HOW_IT_WAS_VIDEO_ID = "CxTwKZNy5lE";

/**
 * Hero + team strip + format band — the "Hero Season v2" design (4a desktop,
 * 4b mobile), rendered from one DOM: the CSS under `.hero--season` in
 * `landing.css` carries both artboards, and the few strings that differ
 * between them (the pill, the lead, the progress labels) are rendered twice
 * and shown by breakpoint (`hero__d` / `hero__m`).
 *
 * The season strip at the bottom is live data: one dot per night of the
 * current rating series, each a link to its event page; done / next / later
 * follow the events' lifecycle status, and the red fill reaches the last
 * night that has run.
 *
 * `registrationOpen` drives the primary CTA exactly as before: when a
 * featured event is taking registrations it points at `registerHref`,
 * otherwise at the results.
 */
export function Hero({
  registrationOpen,
  registerHref = "/register",
  season,
}: {
  registrationOpen: boolean;
  registerHref?: string;
  season: SeasonStrip;
}) {
  const t = useTranslations("landing.seasonHero");
  const fb = useTranslations("landing.formatBand");

  const total = season.nights.length;
  const done = season.nights.filter((n) => n.done).length;
  const next = season.nights.find((n) => n.next) ?? null;
  // The red fill reaches the centre of the last night that has run: the first
  // dot sits on the track's left end, the last on its right, the rest centred
  // in equal columns — the same geometry the dots' grid below produces.
  const lastDone = season.nights.reduce((acc, n, i) => (n.done ? i : acc), -1);
  const progress =
    lastDone < 0 || total < 2
      ? 0
      : lastDone === total - 1
        ? 100
        : lastDone === 0
          ? 0
          : ((lastDone + 0.5) / total) * 100;

  const nightLabel = (n: SeasonStrip["nights"][number]) => {
    const kind = n.last ? t("night.final") : n.done ? t("night.ranking") : t("night.matches");
    const status = n.done ? t("night.done") : n.next ? t("night.next") : null;
    return status ? `${kind} · ${status}` : kind;
  };

  const venueLine = season.firstHeat
    ? t("venueLine", {
        venue: season.venue,
        checkIn: season.checkIn ?? "",
        start: season.firstHeat,
      })
    : season.checkIn
      ? t("venueLineNoStart", { venue: season.venue, checkIn: season.checkIn })
      : season.venue;

  return (
    <header className="hero hero--season" data-screen-label="Hero">
      <div className="hero__stage">
        <div className="hero__bg" aria-hidden>
          <SeasonPhoto />
          <div className="hero__dim" />
          <div className="hero__grad" />
        </div>
        <div className="hero__inner">
          {/* Top nav lives in the fixed <LandingHeader/>, transparent over the hero. */}
          <div className="wrap hero__wrap">
            <div className="hero__content">
              <p className="hero__pill">
                <span className="hero__pill-dot" aria-hidden />
                <span className="hero__d">{t("pill", { from: season.from, to: season.to })}</span>
                <span className="hero__m">
                  {t("pillMobile", { from: season.from, to: season.to })}
                </span>
              </p>
              <h1 className="head hero__title">
                {t.rich("title", {
                  br: () => <br />,
                  red: (chunks) => <span className="red">{chunks}</span>,
                })}
              </h1>
              <p className="hero__sub">{t("sub")}</p>
              <p className="hero__lead">
                <span className="hero__d">{t("lead")}</span>
                <span className="hero__m">{t("leadMobile")}</span>
              </p>
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
                <HashLink href="/#teams" className="btn btn-stroke">
                  {t("ctaSecondary")}
                </HashLink>
              </div>
            </div>

            {total > 0 && (
              <nav
                className="hero__season"
                aria-label={t("stripLabel")}
                style={{ "--progress": `${progress}%`, "--n": total } as React.CSSProperties}
              >
                <div className="hero__season-row">
                  <span>
                    <span className="hero__d">{t("progress", { done, total })}</span>
                    <span className="hero__m">{t("progressMobile", { done, total })}</span>
                  </span>
                  <span>
                    <span className="hero__d">{venueLine}</span>
                    <span className="hero__m">
                      {next
                        ? t("nextMobile", {
                            date: next.day,
                            kind: next.last ? t("night.finalShort") : t("night.matchesShort"),
                          })
                        : t("seasonDone")}
                    </span>
                  </span>
                </div>
                <div className="hero__track" aria-hidden>
                  <div className="hero__track-fill" />
                </div>
                <ol className="hero__nights">
                  {season.nights.map((n) => (
                    <li key={n.slug}>
                      <Link
                        href={`/events/${n.slug}`}
                        className={[
                          "hero__night",
                          n.done && "hero__night--done",
                          n.next && "hero__night--next",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        aria-current={n.next ? "step" : undefined}
                      >
                        <span className="hero__night-dot" aria-hidden />
                        <span className="hero__night-text">
                          <span className="hero__night-date">{n.day}</span>
                          <span className="hero__night-label">{nightLabel(n)}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
              </nav>
            )}
          </div>
        </div>
      </div>

      <SeasonTeams />

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
    </header>
  );
}

/**
 * The hero photo, art-directed: a landscape crop of the start line for the
 * desktop artboard, a portrait crop (390×800 proportions) for the phone one,
 * both cut from the same frame. A `<picture>` so the browser fetches only the
 * crop it shows; the srcsets come from `getImageProps` so each still goes
 * through the image optimizer, as every other landing photo does.
 */
function SeasonPhoto() {
  const common = { alt: "", sizes: "100vw", priority: true };
  const {
    props: { srcSet: desktop },
  } = getImageProps({
    ...common,
    src: "/landing/season-teams-desktop.jpg",
    width: 1440,
    height: 937,
  });
  const {
    props: { srcSet: mobile, ...rest },
  } = getImageProps({
    ...common,
    src: "/landing/season-teams-mobile.jpg",
    width: 780,
    height: 1600,
  });
  return (
    <picture>
      <source media="(min-width: 641px)" srcSet={desktop} />
      <source media="(max-width: 640px)" srcSet={mobile} />
      <img {...rest} alt="" className="hero__photo" />
    </picture>
  );
}
