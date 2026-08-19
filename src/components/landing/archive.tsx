import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { GALLERY_THUMB_SIZE, driveThumbUrl } from "@/lib/events/drive-urls";
import type { EventMediaConfig } from "@/lib/events/media-config";
import type { EventSummary } from "@/lib/events/types";

/**
 * Landing "archive" section — one card per completed individual event, newest
 * first, linking into its detail page (the archive view: inline results +
 * gallery preview). The cover is the gallery's publish-time cover snapshot
 * (`event_media.cover_file_id`), so this renders without a single Drive API
 * call; events whose gallery isn't published yet render a text-only card (no
 * cover strip, no gallery link — the news-card idiom), which keeps the section
 * quiet rather than promising photos it can't show. Kept in sync by the media
 * publish/unpublish actions' `revalidatePath("/[locale]", "page")`, same as
 * the news section.
 */
export async function Archive({
  events,
  media,
}: {
  events: EventSummary[];
  media: Map<string, EventMediaConfig>;
}) {
  const t = await getTranslations("landing.archive");

  return (
    <section className="section archive-sec" id="archive" data-screen-label="Archive">
      <div className="wrap">
        <div className="archive-sec__head">
          <p className="ev-eyebrow">{t("eyebrow")}</p>
          <h2 className="head t-sec">{t("title")}</h2>
          <p className="sub-lead">{t("subtitle")}</p>
        </div>

        <div className="archive-sec__grid">
          {events.map((event) => {
            const published = media.get(event.slug);
            return (
              <article className="archive-card" key={event.slug} data-archive-card={event.slug}>
                {published?.coverFileId ? (
                  <Link href={`/events/${event.slug}`} className="archive-card__cover">
                    {/* eslint-disable-next-line @next/next/no-img-element -- Drive-hosted cover, pre-sized via `sz` (Drive is the CDN). */}
                    <img
                      src={driveThumbUrl(published.coverFileId, GALLERY_THUMB_SIZE)}
                      alt=""
                      loading="lazy"
                    />
                  </Link>
                ) : null}
                <span className="archive-card__date">{event.shortDate}</span>
                <h3 className="archive-card__title">
                  <Link href={`/events/${event.slug}`}>{event.name}</Link>
                </h3>
                <p className="archive-card__meta">
                  {event.venue}, {event.city}
                </p>
                <div className="archive-card__links">
                  <Link href={`/events/${event.slug}`} className="archive-card__more">
                    {t("details")} →
                  </Link>
                  {published ? (
                    <Link href={`/events/${event.slug}/gallery`} className="archive-card__more">
                      {t("gallery")} →
                    </Link>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
