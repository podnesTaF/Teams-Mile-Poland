/* eslint-disable @next/next/no-img-element -- Covers and strips are Drive-hosted
 * and pre-sized via the `sz` param (Drive is the CDN, PRD #14); next/image would
 * re-optimize them at request time and defeat that. Same policy as the gallery. */

import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import "@/app/landing.css";
import "@/app/series-flows.css";
import "@/app/gallery.css";
import "./gallery-index.css";

import { InteriorHeader } from "@/components/landing/interior-header";
import { Link } from "@/i18n/navigation";
import { GALLERY_THUMB_SIZE, driveThumbUrl } from "@/lib/events/drive-urls";
import { listEventMedia } from "@/lib/events/media";
import { getGalleryEvents, type GalleryEntry } from "@/lib/events/media-config";
import { formatEventLongDate } from "@/lib/events/time";
import type { EventMediaItem } from "@/lib/events/types";

/**
 * Safety-net ISR, same as the per-event gallery: the media publish/unpublish
 * actions revalidate this path directly, so a flip shows up at once; the
 * interval only bounds staleness after a write that bypasses the app (a manual
 * DB correction). Must stay a literal — the value is statically analyzed.
 */
export const revalidate = 300;

/** Thumbnails shown per event before the card hands over to its gallery. */
const STRIP_COUNT = 6;

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "gallery" });
  return { title: t("meta.title") };
}

/**
 * The public gallery index — every completed race night with a published Drive
 * gallery, newest first, one card each: the publish-time cover, counts, a short
 * strip of thumbnails, and links into the night's gallery and its event page.
 * Fully public. Which nights appear is the `event_media` table's business
 * (`getGalleryEvents`), not a code edit — the same rule as the archive section.
 */
export default async function GalleryIndexPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("gallery");
  const common = await getTranslations("common");
  const entries = await getGalleryEvents();
  // Strips list each folder live; the page is cached, so this runs per
  // revalidation, not per request. A failing folder degrades to cover-only.
  const strips = await Promise.all(entries.map(loadStrip));

  return (
    <div className="ace-landing iv">
      <InteriorHeader />
      <main className="iv-main">
        <div className="wrap">
          <header className="gi-head">
            <span className="ev-eyebrow">{t("eyebrow")}</span>
            <h1 className="gallery-title">{t("title")}</h1>
            <p className="gi-sub">{t("subtitle")}</p>
          </header>

          {entries.length === 0 ? (
            <section className="media-soon" data-gallery-index-empty>
              <p className="media-soon__txt">{t("empty")}</p>
            </section>
          ) : (
            <div className="gi-list" data-gallery-index>
              {entries.map(({ event, media }, index) => {
                const galleryHref = `/events/${event.slug}/gallery`;
                const strip = strips[index];
                return (
                  <article className="gi-card" key={event.slug} data-gallery-card={event.slug}>
                    {media.coverFileId ? (
                      <Link href={galleryHref} className="gi-card__cover" aria-label={event.name}>
                        <img
                          src={driveThumbUrl(media.coverFileId, GALLERY_THUMB_SIZE)}
                          alt=""
                          loading={index === 0 ? "eager" : "lazy"}
                        />
                      </Link>
                    ) : null}

                    <div className="gi-card__body">
                      <span className="gi-card__date">{event.shortDate}</span>
                      <h2 className="gi-card__title">
                        <Link href={galleryHref}>{event.name}</Link>
                      </h2>
                      <p className="gi-card__meta">
                        {formatEventLongDate(locale, event.date)} · {event.venue}, {event.city}
                      </p>
                      <p className="gi-card__counts">
                        <span>{t("photos", { count: media.photoCount })}</span>
                        {media.videoCount > 0 ? (
                          <span>{t("videos", { count: media.videoCount })}</span>
                        ) : null}
                      </p>
                      <div className="gi-card__links">
                        <Link href={galleryHref} className="btn btn-red btn-sm">
                          {t("view")}
                        </Link>
                        <Link href={`/events/${event.slug}`} className="gi-card__more">
                          {t("event")}
                        </Link>
                      </div>
                    </div>

                    {strip.length > 0 ? (
                      <div className="gi-card__strip">
                        {strip.map((item) => (
                          <Link
                            key={item.id}
                            href={galleryHref}
                            className="gi-card__cell"
                            aria-label={item.name}
                          >
                            <img
                              src={driveThumbUrl(item.id, GALLERY_THUMB_SIZE)}
                              alt={item.name}
                              loading="lazy"
                            />
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}

          <div className="iv-actions gi-actions">
            <Link href="/" className="btn btn-stroke-dark">
              {common("backToLanding")}
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

/**
 * The first few photos of a published folder (falling back to whatever exists
 * for a video-only drop). Empty on a Drive failure — the card still renders
 * from its stored cover and counts, it just loses the strip.
 */
async function loadStrip({ event, media }: GalleryEntry): Promise<EventMediaItem[]> {
  try {
    const items = await listEventMedia(media.driveFolderId);
    const photos = items.filter((item) => item.kind === "photo");
    return (photos.length > 0 ? photos : items).slice(0, STRIP_COUNT);
  } catch (error) {
    console.error(`[media] gallery index strip for ${event.slug} failed; cover only:`, error);
    return [];
  }
}
