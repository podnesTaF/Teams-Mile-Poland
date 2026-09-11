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

/** YouTube clip behind the video card above the chips. */
const INVITE_VIDEO_ID = "X8wbdTMgxJ0";

/**
 * This clip is a 2.35:1 master, so YouTube's poster frame carries a black
 * bar over 11.84% of its height at each end (measured off the CDN image).
 * `1 / (1 - 2 * 0.1184)` zooms them out of the card.
 */
const INVITE_POSTER_ZOOM = 1.32;

/** Interlude under the role cards: video card + chips + headline + CTA. */
export function Invite({ registerHref = "/register" }: { registerHref?: string }) {
  const t = useTranslations("landing.invite");

  return (
    <div className="wrap invite !pt-10">
      <VideoPlay
        label={t("videoLabel")}
        videoId={INVITE_VIDEO_ID}
        variant="card"
        posterZoom={INVITE_POSTER_ZOOM}
      />
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
