"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { AudioPlay } from "@/components/landing/audio-play";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/landing/icons";
import { cn } from "@/lib/utils";

const ANTHEM_SRC = "/audio/AUD-20260602-WA0000.mp3";

const GALLERY = [
  "/landing/brussels-podium.jpg",
  "/images/_DSC4433.jpg",
  "/landing/IMG_1568.jpg",
  "/landing/_DSC8201.jpg",
  "/images/teams-photo.jpg",
  "/images/_DSC3931.jpg",
  "/images/teams-start.jpg",
  "/images/_DSC2811.jpg",
  "/landing/IMG_0614.jpg",
  "/images/finish-girl.jpg",
  "/images/DJI_0256.jpg",
  "/landing/_DSC5903.jpg",
  "/images/_DSC3921.jpg",
  "/landing/IMG_0561.jpg",
  "/images/teams-run.jpg",
  "/landing/brussels-podium2.jpg",
  "/images/_DSC2661.jpg",
  "/images/stretch.jpg",
  "/images/_DSC3241.jpg",
  "/images/DJI_0233.jpg",

  "/images/_DSC2825.jpg",
  "/images/_DSC4481.jpg",
] as const;

/**
 * "Feel the atmosphere" — big photo + thumbnails.
 * Clicking a thumbnail or the prev/next arrows swaps the big photo above.
 */
function scrollGalleryThumb(gallery: HTMLElement, thumb: HTMLElement) {
  const left = thumb.offsetLeft - (gallery.clientWidth - thumb.clientWidth) / 2;
  gallery.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
}

export function Atmosphere() {
  const t = useTranslations("landing.atmosphere");
  const [activeIndex, setActiveIndex] = useState(0);
  const galleryRef = useRef<HTMLDivElement>(null);
  const active = GALLERY[activeIndex];

  function selectIndex(index: number) {
    const next = (index + GALLERY.length) % GALLERY.length;
    setActiveIndex(next);

    const gallery = galleryRef.current;
    const thumb = gallery?.children[next] as HTMLElement | undefined;
    if (gallery && thumb) scrollGalleryThumb(gallery, thumb);
  }

  return (
    <section className="section" style={{ paddingBottom: 0 }} data-screen-label="Atmosphere">
      <div className="wrap center">
        <h2 className="head t-sec">{t("title")}</h2>
        <AudioPlay
          src={ANTHEM_SRC}
          label={t("playLabel")}
          playAriaLabel={t("playAriaLabel")}
          pauseAriaLabel={t("pauseAriaLabel")}
        />
      </div>
      <div className="atmo-viewer">
        <button
          type="button"
          className="atmo-nav atmo-nav--prev"
          aria-label={t("prevPhotoLabel")}
          onClick={() => selectIndex(activeIndex - 1)}
        >
          <ChevronLeftIcon width={24} height={24} />
        </button>
        <Image
          key={active}
          className="atmo-photo"
          src={active}
          alt={t("photoAlt")}
          width={1920}
          height={1080}
          priority={false}
        />
        <button
          type="button"
          className="atmo-nav atmo-nav--next"
          aria-label={t("nextPhotoLabel")}
          onClick={() => selectIndex(activeIndex + 1)}
        >
          <ChevronRightIcon width={24} height={24} />
        </button>
      </div>
      <div className="wrap">
        <div className="gallery" ref={galleryRef}>
          {GALLERY.map((src, index) => (
            <button
              key={src}
              type="button"
              aria-label={t("photoAlt")}
              aria-pressed={index === activeIndex}
              onClick={(e) => selectIndex(index)}
              className={cn("gallery-btn", index === activeIndex && "is-active")}
            >
              <Image src={src} alt="" width={100} height={56} />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
