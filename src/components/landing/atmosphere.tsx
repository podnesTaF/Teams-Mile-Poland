"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { AudioPlay } from "@/components/landing/audio-play";
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
 * Clicking a thumbnail swaps the big photo above (client state).
 */
function scrollGalleryThumb(gallery: HTMLElement, thumb: HTMLElement) {
  const left = thumb.offsetLeft - (gallery.clientWidth - thumb.clientWidth) / 2;
  gallery.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
}

export function Atmosphere() {
  const t = useTranslations("landing.atmosphere");
  const [active, setActive] = useState<string>(GALLERY[0]);
  const galleryRef = useRef<HTMLDivElement>(null);

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
      <Image
        key={active}
        className="atmo-photo"
        src={active}
        alt={t("photoAlt")}
        width={1920}
        height={1080}
        style={{ marginTop: "clamp(40px,5vw,64px)" }}
        priority={false}
      />
      <div className="wrap">
        <div className="gallery" ref={galleryRef}>
          {GALLERY.map((src) => (
            <button
              key={src}
              type="button"
              aria-label={t("photoAlt")}
              aria-pressed={src === active}
              onClick={(e) => {
                setActive(src);
                const gallery = galleryRef.current;
                if (gallery) scrollGalleryThumb(gallery, e.currentTarget);
              }}
              className={cn("gallery-btn", src === active && "is-active")}
            >
              <Image src={src} alt="" width={100} height={56} />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
