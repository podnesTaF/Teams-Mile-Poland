import Image from "next/image";
import { useTranslations } from "next-intl";

/** Checklist item → masked SVG icon file. */
const ITEMS = [
  { id: "cafe", icon: "ic-coffee" },
  { id: "medical", icon: "ic-medbag" },
  { id: "fans", icon: "ic-corporate" },
  { id: "timing", icon: "ic-chip" },
] as const;

const MAPS_URL =
  "https://www.google.com/maps/search/?api=1&query=Stadion%20Podskarbi%C5%84ska%2C%20Warsaw";

function maskStyle(icon: string) {
  const url = `url(/landing/icons/${icon}.svg)`;
  return { WebkitMaskImage: url, maskImage: url } as React.CSSProperties;
}

/** Venue section: side-by-side image + 4-item checklist, with the left-edge wedge vector behind. */
export function Location() {
  const t = useTranslations("landing.location");

  return (
    <section className="section location" id="location" data-screen-label="Location">
      <Image
        className="loc-wedge"
        src="/landing/icons/loc-wedge.svg"
        alt=""
        width={478}
        height={749}
        aria-hidden
      />
      <div className="wrap">
        <div className="center stack" style={{ gap: 8 }}>
          <Image
            className="loc-pin"
            src="/landing/icons/pin.svg"
            alt=""
            width={36}
            height={50}
            aria-hidden
          />
          <h2 className="head loc-title">{t("title")}</h2>
          <p className="head t-20 loc-addr">{t("address")}</p>
        </div>
        <div className="loc-grid">
          <Image
            className="loc-img"
            src="/landing/fig/location.png"
            alt={t("imageAlt")}
            width={587}
            height={503}
          />
          <div>
            <div className="checklist">
              {ITEMS.map(({ id, icon }) => (
                <div key={id} className="check">
                  <span className="check__ic" style={maskStyle(icon)} aria-hidden />
                  <div>
                    <h3 className="check__t">{t(`checklist.${id}.title`)}</h3>
                    <p className="sm">{t(`checklist.${id}.body`)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="loc-btn">
          <a className="btn btn-stroke" href={MAPS_URL} target="_blank" rel="noopener noreferrer">
            {t("mapCta")}
          </a>
        </div>
      </div>
    </section>
  );
}
