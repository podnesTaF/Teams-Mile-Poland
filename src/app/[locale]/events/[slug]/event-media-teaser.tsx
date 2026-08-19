/* eslint-disable @next/next/no-img-element -- Teaser thumbnails are Drive-hosted
 * and pre-sized via the `sz` param (Drive is the CDN, PRD #14); next/image would
 * re-optimize them at request time and defeat that. Same policy as the gallery. */

import { Link } from "@/i18n/navigation";
import { GALLERY_THUMB_SIZE, driveThumbUrl } from "@/lib/events/drive-urls";
import { listEventMedia } from "@/lib/events/media";
import type { EventMediaItem } from "@/lib/events/types";

/** How many photos the teaser shows before "view full gallery" takes over. */
const TEASER_COUNT = 8;

type Props = {
  slug: string;
  folderId: string;
  heading: string;
  viewAll: string;
  /** Localized, pluralized video count (ICU) — only rendered when > 0. */
  videoCount: (count: number) => string;
  /** Fallback copy when the published folder can't be listed right now. */
  comingSoon: string;
};

/**
 * The media teaser strip on a completed event's detail page: the discovery
 * surface for the gallery shipped in #16. Server component — lists the folder
 * the admin published (`event_media` row), which the publish action already
 * verified; the page is cached until the next media/results revalidation, so
 * the listing does not run per request. A transient Drive failure degrades to
 * the "coming soon" note rather than 500ing the event page. Renders the first
 * {@link TEASER_COUNT} photos plus a video count, all linking through to
 * `/events/<slug>/gallery`.
 */
export async function EventMediaTeaser({
  slug,
  folderId,
  heading,
  viewAll,
  videoCount,
  comingSoon,
}: Props) {
  let items: EventMediaItem[];
  try {
    items = await listEventMedia(folderId);
  } catch (error) {
    console.error(`[media] teaser listing for ${slug} failed; showing coming-soon:`, error);
    return (
      <section className="media-soon">
        <span className="ev-eyebrow">{heading}</span>
        <p className="media-soon__txt">{comingSoon}</p>
      </section>
    );
  }
  const photos = items.filter((item) => item.kind === "photo");
  const videos = items.length - photos.length;
  // Prefer photos for the strip; fall back to whatever exists so a video-only
  // drop still shows a filled band rather than an empty one.
  const strip = (photos.length > 0 ? photos : items).slice(0, TEASER_COUNT);
  const galleryHref = `/events/${slug}/gallery`;

  return (
    <section className="media-teaser">
      <div className="media-teaser__head">
        <span className="ev-eyebrow">{heading}</span>
        {videos > 0 && <span className="media-teaser__vcount">{videoCount(videos)}</span>}
      </div>

      <div className="media-teaser__strip">
        {strip.map((item) => (
          <Link key={item.id} href={galleryHref} className="media-teaser__cell" aria-label={item.name}>
            <img src={driveThumbUrl(item.id, GALLERY_THUMB_SIZE)} alt={item.name} loading="lazy" />
          </Link>
        ))}
      </div>

      <Link href={galleryHref} className="btn btn-red btn-sm media-teaser__cta">
        {viewAll}
      </Link>
    </section>
  );
}
