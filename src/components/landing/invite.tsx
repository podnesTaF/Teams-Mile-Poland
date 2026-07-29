import Image from "next/image";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

import { VideoPlay } from "./video-play";

/** Chip → vector icon file in /vectors/chips. */
const CHIPS = [
  { id: "one", icon: "Icons" },
  { id: "two", icon: "Icons-1" },
  { id: "three", icon: "Icons-2" },
] as const;

/** YouTube clip opened by the play button above the chips. */
const INVITE_VIDEO_ID = "X8wbdTMgxJ0";

/** White interlude: video play button + chips + headline + CTA. */
export function Invite() {
  const t = useTranslations("landing.invite");

  return (
      <div className="wrap invite !pt-10">
        <VideoPlay label={t("videoLabel")} videoId={INVITE_VIDEO_ID} variant="row" />
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
  );
}
