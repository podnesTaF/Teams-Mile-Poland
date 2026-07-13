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
import { getEventBySlug, getGalleryEvents } from "@/lib/events/registry";

import { GalleryLightbox } from "./gallery-lightbox";

const DATE_TAG: Record<string, string> = { en: "en-GB", pl: "pl-PL", ua: "uk-UA" };

export function generateStaticParams() {
  // Only completed individual events with published media get a gallery page.
  // A completed event without `media` builds fine with no gallery route.
  return getGalleryEvents().map((event) => ({ slug: event.slug }));
}

type PageProps = { params: Promise<{ locale: string; slug: string }> };

/**
 * Social-share metadata so a pasted gallery link unfurls as a branded landing
 * card (user story #21): event name in the title, the first photo as the OG
 * image. The `listEventMedia` fetch here is deduped with the page's own call
 * within a render, so this costs no extra Drive request.
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const event = getEventBySlug(slug);
  if (!event?.media || event.eventType !== "individual" || event.status !== "completed") {
    return {};
  }
  const t = await getTranslations({ locale, namespace: "events" });
  const title = `${event.name} — ${t("media.eyebrow")}`;
  const items = await listEventMedia(event.media.driveFolderId);
  const cover = items.find((item) => item.kind === "photo");
  return {
    title,
    openGraph: {
      title,
      images: cover ? [driveThumbUrl(cover.id, GALLERY_LARGE_SIZE)] : undefined,
    },
  };
}

export default async function GalleryPage({ params }: PageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const event = getEventBySlug(slug);
  // Fully public — no auth gate. 404 for anything that isn't a completed
  // individual event with published media (mirrors the static params).
  if (
    !event ||
    event.eventType !== "individual" ||
    event.status !== "completed" ||
    !event.media
  ) {
    notFound();
  }

  const t = await getTranslations("events");
  // Build-time listing; throws (fails the build) if the folder can't be read.
  const items = await listEventMedia(event.media.driveFolderId);

  const longDate = new Intl.DateTimeFormat(DATE_TAG[locale] ?? "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Warsaw",
  }).format(new Date(`${event.date}T12:00:00+02:00`));

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
              href={driveAlbumUrl(event.media.driveFolderId)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-stroke-dark btn-sm gallery-album"
            >
              {t("media.openAlbum")}
            </a>
          </header>

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
        </div>
      </main>
    </div>
  );
}
