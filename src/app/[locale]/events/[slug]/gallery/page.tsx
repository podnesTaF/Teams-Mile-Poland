import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import "@/app/landing.css";
import "@/app/series-flows.css";
import "@/app/gallery.css";

import { InteriorHeader } from "@/components/landing/interior-header";
import { Link } from "@/i18n/navigation";
import {
  GALLERY_LARGE_SIZE,
  driveAlbumUrl,
  driveThumbUrl,
} from "@/lib/events/drive-urls";
import { listEventMedia } from "@/lib/events/media";
import { getEventMediaConfig } from "@/lib/events/media-config";
import { getEventBySlug } from "@/lib/events/registry";
// Straight from the store, not the `registry` compat shim: `isPubliclyVisible`
// is new API, and the shim exists only so the pre-DB call sites kept compiling.
import { isPubliclyVisible } from "@/lib/events/store";
import { formatEventLongDate } from "@/lib/events/time";
import type { EventMediaItem } from "@/lib/events/types";

import { GalleryLightbox } from "./gallery-lightbox";

export async function generateStaticParams() {
  // Deliberately empty, not omitted (the start-list pattern, issue #31): which
  // events have a gallery lives in the `event_media` DB table now, so paths
  // can't be known at build time. An empty array renders each path on first
  // visit and then caches it — which is what lets the admin publish action's
  // `revalidatePath` actually flip a gallery live without a deploy. Omitting
  // the export would re-render every request and make that a no-op.
  //
  // So there is no visibility filter to apply here either: no path is
  // prerendered, and the gate lives in the page and its metadata below.
  return [];
}

/**
 * Safety-net ISR on top of the publish action's `revalidatePath`: a write that
 * bypasses the app (a manual DB correction, a seed) reaches no revalidation and
 * would leave a cached gallery stale until a deploy. Five minutes bounds that;
 * the admin publish still flips it instantly. Must stay a literal — the value
 * is statically analyzed.
 */
export const revalidate = 300;

type PageProps = { params: Promise<{ locale: string; slug: string }> };

/**
 * Social-share metadata so a pasted gallery link unfurls as a branded landing
 * card (user story #21): event name in the title, the cover photo (captured at
 * publish time) as the OG image — no Drive call needed here.
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const event = await getEventBySlug(slug);
  // Same gate as the page — an unannounced night gets no title and no OG image.
  if (!event || event.eventType !== "individual" || !isPubliclyVisible(event)) {
    notFound();
  }
  if (event.status !== "completed") {
    return {};
  }
  const media = await getEventMediaConfig(slug);
  if (!media) return {};
  const t = await getTranslations({ locale, namespace: "events" });
  const title = `${event.name} — ${t("media.eyebrow")}`;
  return {
    title,
    openGraph: {
      title,
      images: media.coverFileId
        ? [driveThumbUrl(media.coverFileId, GALLERY_LARGE_SIZE)]
        : undefined,
    },
  };
}

export default async function GalleryPage({ params }: PageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const event = await getEventBySlug(slug);
  // Fully public — no auth gate. 404 for anything with no public surface
  // (`isPubliclyVisible`: a draft), and for anything that isn't a completed
  // individual event (mirrors the admin publish guard) …
  //
  // The `completed` requirement already implies both — a draft is not completed,
  // and slice 02 refuses `completed → cancelled` — but the visibility gate is
  // stated anyway, so this page keeps 404ing drafts if the gallery ever opens up
  // to a non-completed state.
  if (!event || event.eventType !== "individual" || !isPubliclyVisible(event)) {
    notFound();
  }
  if (event.status !== "completed") {
    notFound();
  }
  // … or whose media isn't published. `getEventMediaConfig` is request-cached,
  // so metadata and page share one read.
  const media = await getEventMediaConfig(slug);
  if (!media) {
    notFound();
  }

  const t = await getTranslations("events");
  // The publish action verified this folder lists cleanly; a failure here is a
  // transient Drive error on a page that was fine — degrade to the album link
  // rather than 500ing a published gallery.
  let items: EventMediaItem[] | null = null;
  try {
    items = await listEventMedia(media.driveFolderId);
  } catch (error) {
    console.error(`[media] gallery listing for ${slug} failed; showing album link only:`, error);
  }

  const longDate = formatEventLongDate(locale, event.date);

  return (
    <div className="ace-landing iv">
      <InteriorHeader />
      <main className="iv-main">
        <div className="wrap">
          <Link href={`/events/${slug}`} className="detail-back">
            {t("media.back")}
          </Link>

          <header className="gallery-head">
            <div className="gallery-head__text">
              <span className="ev-eyebrow">{t("media.eyebrow")}</span>
              <h1 className="gallery-title">{event.name}</h1>
              <p className="gallery-sub">
                {longDate} · {event.venue}, {event.city}
              </p>
            </div>
            <a
              href={driveAlbumUrl(media.driveFolderId)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-stroke-dark btn-sm gallery-album"
            >
              {t("media.openAlbum")}
            </a>
          </header>

          {items ? (
            <GalleryLightbox
              items={items}
              labels={{
                photos: t("media.photos"),
                videos: t("media.videos"),
                download: t("media.download"),
                close: t("media.close"),
                prev: t("media.prev"),
                next: t("media.next"),
                playVideo: t("media.playVideo"),
              }}
            />
          ) : (
            <section className="media-soon" data-gallery-unavailable>
              <p className="media-soon__txt">{t("media.unavailable")}</p>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
