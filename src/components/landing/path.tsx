import Image from "next/image";
import { useTranslations } from "next-intl";

import { VideoPlay } from "./video-play";

/** Video presentation opened by the play button under the closing manifesto. */
const PATH_VIDEO_ID = "CxTwKZNy5lE";

/** Each step → its tile SVG (self-coloured artwork, rendered as <img>). */
const STEPS = [
  { id: "one", tile: "tile-sneaker" },
  { id: "two", tile: "tile-rating" },
  { id: "three", tile: "tile-friend" },
  { id: "four", tile: "tile-flag" },
  { id: "five", tile: "tile-globe" },
] as const;

/** "Your path forward" — 5 tile nodes connected by a dashed line, plus the closing manifesto under a flag. */
export function PathForward() {
  const t = useTranslations("landing.path");

  return (
    <section className="section path" data-screen-label="Path">
      <Image
        className="sect-glow sect-glow--right"
        src="/landing/icons/roles-glow.svg"
        alt=""
        width={1352}
        height={1096}
        aria-hidden
      />
      <div className="wrap center">
        <h2 className="head t-sec">{t("title")}</h2>
        <div className="path-grid">
          {STEPS.map(({ id, tile }) => (
            <div key={id} className="pcard">
              <Image
                className="ptile"
                src={`/landing/icons/${tile}.svg`}
                alt=""
                width={64}
                height={64}
                aria-hidden
              />
              <h3 className="pcard__t">{t(`steps.${id}.title`)}</h3>
              <p>{t(`steps.${id}.body`)}</p>
            </div>
          ))}
        </div>
        <div className="path-foot">
          <span className="flag">{t("flag")}</span>
          <p className="lead">
            {t.rich("foot", { red: (chunks) => <span className="red">{chunks}</span> })}
          </p>
          <VideoPlay label={t("videoLabel")} videoId={PATH_VIDEO_ID} />
        </div>
      </div>
    </section>
  );
}
