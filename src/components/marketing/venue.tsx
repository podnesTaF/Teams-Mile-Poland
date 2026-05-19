import Image from "next/image";
import { useTranslations } from "next-intl";

import { Eyebrow } from "@/components/ui/eyebrow";
import { EVENT } from "@/lib/marketing/event";

export function Venue() {
  const t = useTranslations("venue");

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[1.1fr_1fr] md:items-center md:gap-12">
      <div className="relative aspect-[4/3] w-full bg-bg-2">
        <Image
          src="/images/stadium.webp"
          alt={t("imageAlt", { venue: EVENT.venue.name })}
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-contain"
        />
      </div>
      <div>
        <Eyebrow>{t("eyebrow")}</Eyebrow>
        <h2 className="mb-5 mt-2">{EVENT.venue.name}</h2>
        <p className="m-0 mb-6 max-w-[36ch] text-lg leading-relaxed text-muted">
          {t("description")}
        </p>
        <div className="border border-line bg-bg">
          <div className="border-b border-line p-[18px]">
            <Eyebrow>{t("address")}</Eyebrow>
            <div className="mt-1 font-display-alt font-semibold">
              {EVENT.venue.address}
              <br />
              {EVENT.venue.postal} {EVENT.venue.city}, {EVENT.venue.country}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 p-[18px]">
            <div>
              <Eyebrow>{t("track")}</Eyebrow>
              <div className="mt-1 font-display-alt font-semibold">
                {EVENT.venue.track.length} · {EVENT.venue.track.lanes} lanes
              </div>
            </div>
            <div>
              <Eyebrow>{t("surface")}</Eyebrow>
              <div className="mt-1 font-display-alt font-semibold">
                {EVENT.venue.track.surface}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
