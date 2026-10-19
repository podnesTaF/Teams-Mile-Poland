import Image from "next/image";
import { useTranslations } from "next-intl";

import { HashLink } from "@/components/ui/hash-link";

import { VideoPlay } from "./video-play";

/** Chip → vector icon file in /vectors/chips. */
const CHIPS = [
  { id: "one", icon: "Icons" },
  { id: "two", icon: "Icons-1" },
  { id: "three", icon: "Icons-2" },
] as const;

/** YouTube clips behind the video cards above the chips: the team game, then the rating run. */
const GAME_VIDEO_ID = "Dvn_9nUVui4";
const RATING_VIDEO_ID = "X8wbdTMgxJ0";

/**
 * Both clips are 2.35:1 masters, so YouTube's poster frame carries a black
 * bar over ~11.8% of its height at each end (measured off the CDN images).
 * `1 / (1 - 2 * 0.1184)` zooms them out of the card.
 */
const INVITE_POSTER_ZOOM = 1.32;

/** Interlude under the role cards: video cards + chips + headline + CTA. */
export function Invite({ registerHref = "/register" }: { registerHref?: string }) {
  const t = useTranslations("landing.invite");

  return (
    <div className="wrap invite !pt-10">
      <div className="invite__videos">
        <VideoPlay
          label={t("gameVideoLabel")}
          videoId={GAME_VIDEO_ID}
          variant="card"
          posterZoom={INVITE_POSTER_ZOOM}
        />
        <VideoPlay
          label={t("videoLabel")}
          videoId={RATING_VIDEO_ID}
          variant="card"
          posterZoom={INVITE_POSTER_ZOOM}
        />
      </div>
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
      <HashLink href={registerHref} className="btn btn-red">
        {t("cta")}
      </HashLink>
    </div>
  );
}
