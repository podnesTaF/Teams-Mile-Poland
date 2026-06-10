"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

const GALLERY = [
  "/images/teams-start.jpg",
  "/images/finish-girl.jpg",
  "/images/stretch.jpg",
  "/images/teams-photo.jpg",
  "/images/teams-run.jpg",
  "/images/DJI_0233.jpg",
  "/images/DJI_0256.jpg",
  "/images/_DSC2661.jpg",
  "/images/_DSC2811.jpg",
  "/images/_DSC2825.jpg",
  "/images/_DSC3241.jpg",
  "/images/_DSC3921.jpg",
  "/images/_DSC3931.jpg",
  "/images/_DSC4433.jpg",
  "/images/_DSC4481.jpg",
] as const;

/**
 * "Feel the atmosphere" — big photo + thumbnails.
 * Clicking a thumbnail swaps the big photo above (client state).
 */
export function Atmosphere() {
  const t = useTranslations("landing.atmosphere");
  const [active, setActive] = useState<string>(GALLERY[0]);
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({
      inline: "center",
      block: "nearest",
      behavior: "smooth",
    });
  }, [active]);

  return (
    <section className="section" style={{ paddingBottom: 0 }} data-screen-label="Atmosphere">
      <div className="wrap center">
        <h2 className="head t-sec">{t("title")}</h2>
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
        <div className="gallery">
          {GALLERY.map((src) => (
            <button
              key={src}
              ref={src === active ? activeRef : undefined}
              type="button"
              aria-label={t("photoAlt")}
              aria-pressed={src === active}
              onClick={() => setActive(src)}
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
