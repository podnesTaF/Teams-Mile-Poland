import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { requireAdmin } from "@/features/admin/action-helpers";
import { AdminFlash } from "@/features/admin/components/admin-flash";
import { ConfirmSubmit } from "@/features/admin/components/confirm-submit";
import { NoDatabaseNotice } from "@/features/admin/components/no-database-notice";
import { adminButton } from "@/features/admin/components/shell/admin-button";
import { ADMIN_NOTE, ADMIN_TITLE, adminCard } from "@/features/admin/components/shell/admin-card";
import { AdminField, adminInput } from "@/features/admin/components/shell/admin-field";
import { AdminStat } from "@/features/admin/components/shell/admin-stat";
import { publishEventMedia, unpublishEventMedia } from "@/features/admin/media-actions";
import { sendMediaLiveMailingAction } from "@/features/event-mailings/media-live-actions";
import { Link } from "@/i18n/navigation";
import { userCan } from "@/lib/auth/user-session";
import { GALLERY_THUMB_SIZE, driveAlbumUrl, driveThumbUrl } from "@/lib/events/drive-urls";
import { getEventMediaConfig } from "@/lib/events/media-config";
import { getEventBySlug } from "@/lib/events/registry";
import { cn } from "@/lib/utils";

type PageProps = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ ok?: string; error?: string; msg?: string; photos?: string; videos?: string }>;
};

/**
 * The Media tab: where an event's Drive gallery is published (PRD #14, now
 * admin-managed rather than a config edit + deploy). One panel states the
 * current publication, one publishes/replaces the folder, and the photos-live
 * mailing button lives here too — everything media sits on this tab. The event
 * chrome comes from the layout.
 */
export default async function AdminEventMediaPage({ params, searchParams }: PageProps) {
  const { locale, slug } = await params;
  const query = await searchParams;
  setRequestLocale(locale);
  const actor = await requireAdmin(locale);
  // Publishing, unpublishing and the photos-live mailing are all `edit` acts;
  // the published state and the links to it are the read every level gets.
  const canEdit = userCan(actor, "edit");

  const event = getEventBySlug(slug);
  if (!event || event.eventType !== "individual") notFound();

  if (!process.env.DATABASE_URL) {
    return <NoDatabaseNotice>manage this event&apos;s gallery</NoDatabaseNotice>;
  }

  const media = await getEventMediaConfig(slug);
  const completed = event.status === "completed";

  return (
    <>
      <AdminFlash query={query} context={{ slug }} />

      {media ? (
        <>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <AdminStat label="Photos" value={media.photoCount} />
            <AdminStat label="Videos" value={media.videoCount} />
          </div>

          <section className={adminCard("mt-4 p-4 sm:p-5")} data-media-published>
            <h2 className={ADMIN_TITLE}>Gallery published</h2>
            <p className={cn(ADMIN_NOTE, "mt-1.5 max-w-[78ch]")}>
              The public gallery lists this Drive folder live; the counts above are from the last
              publish. If the photographer adds files, re-publish the same folder to refresh the
              cover and counts shown on the landing.
            </p>

            <div className="mt-3 flex flex-wrap items-start gap-4">
              {media.coverFileId ? (
                // eslint-disable-next-line @next/next/no-img-element -- Drive-hosted, pre-sized via `sz` (Drive is the CDN).
                <img
                  src={driveThumbUrl(media.coverFileId, GALLERY_THUMB_SIZE)}
                  alt="Gallery cover"
                  className="h-24 w-36 rounded-admin border border-admin-line object-cover"
                />
              ) : null}
              <div className="min-w-0">
                <p className="font-mono text-[12px] text-admin-ink-2 break-all">
                  {media.driveFolderId}
                </p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  <Link href={`/events/${slug}/gallery`} className={adminButton()}>
                    View public gallery
                  </Link>
                  <a
                    href={driveAlbumUrl(media.driveFolderId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={adminButton()}
                  >
                    Open Drive album ↗
                  </a>
                </div>
              </div>
            </div>
          </section>

          {canEdit ? (
          <section className={adminCard("mt-4 p-4 sm:p-5")}>
            <h2 className={ADMIN_TITLE}>Tell the runners</h2>
            <p className={cn(ADMIN_NOTE, "mt-1.5 max-w-[78ch]")}>
              Emails every registered participant of this event that their gallery is live, with a
              link to it. Anyone already emailed for this event is skipped, so nobody is
              double-mailed.
            </p>
            <form action={sendMediaLiveMailingAction} className="mt-3">
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="slug" value={slug} />
              <ConfirmSubmit
                label="Send photos-live email"
                title="Send the photos-live email?"
                message="Emails every registered participant of this event that their gallery is live, with a link to it. Anyone already emailed for this event is skipped, so nobody is double-mailed."
                confirmLabel="Send email"
                danger={false}
                triggerClassName={adminButton()}
              />
            </form>
          </section>
          ) : null}
        </>
      ) : (
        <p className={cn(ADMIN_NOTE)} data-media-unpublished>
          No gallery published — the public event page shows its &ldquo;photos &amp; video coming
          soon&rdquo; note.
        </p>
      )}

      {canEdit && completed ? (
        <section className={adminCard("mt-4 p-4 sm:p-5")}>
          <h2 className={ADMIN_TITLE}>{media ? "Replace the folder" : "Publish the gallery"}</h2>
          <p className={cn(ADMIN_NOTE, "mt-1.5 max-w-[78ch]")}>
            Paste the Google Drive folder that holds the event&apos;s photos and videos — the
            folder link or its bare ID. It must be shared &ldquo;anyone with the link&rdquo;. The
            folder is checked before anything goes live: an unreadable or empty folder is rejected
            here rather than published broken.
          </p>
          <form action={publishEventMedia} className="mt-3 flex flex-wrap items-end gap-2.5">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="slug" value={slug} />
            <AdminField label="Drive folder URL or ID" className="w-full max-w-md">
              <input
                type="text"
                name="folder"
                required
                defaultValue={media?.driveFolderId ?? ""}
                placeholder="https://drive.google.com/drive/folders/…"
                className={adminInput()}
                data-media-folder-input
              />
            </AdminField>
            <button type="submit" className={adminButton()} data-media-publish>
              {media ? "Re-publish" : "Publish gallery"}
            </button>
          </form>
        </section>
      ) : canEdit ? (
        <p className={cn(ADMIN_NOTE, "mt-4")}>
          Publishing opens once the event is completed — the gallery, like the results, is a
          post-race surface.
        </p>
      ) : null}

      {canEdit && media ? (
        <section className={adminCard("mt-4 p-4 sm:p-5")}>
          <h2 className={ADMIN_TITLE}>Unpublish</h2>
          <p className={cn(ADMIN_NOTE, "mt-1.5 max-w-[78ch]")}>
            Takes the gallery off the site: the gallery page stops resolving and the event page
            reverts to &ldquo;coming soon&rdquo;. The Drive folder itself is untouched, and
            photos-live emails already sent keep working as long as you re-publish later.
          </p>
          <form action={unpublishEventMedia} className="mt-3">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="slug" value={slug} />
            <ConfirmSubmit
              label="Unpublish gallery"
              title="Unpublish this gallery?"
              message="The public gallery page will stop resolving and the event page reverts to its coming-soon note. Runners who received the photos-live email will hit a missing page until you re-publish."
              confirmLabel="Unpublish"
              danger
              triggerClassName={adminButton()}
            />
          </form>
        </section>
      ) : null}
    </>
  );
}
