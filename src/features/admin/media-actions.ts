"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { eventMedia } from "@/db/schema";
import { getDb } from "@/lib/db";
import { listEventMedia } from "@/lib/events/media";
import { getEventBySlug } from "@/lib/events/registry";

import { adminPath, requireAdmin, safeLocale } from "./action-helpers";

/**
 * Publishing / unpublishing an event's Drive gallery — the admin actions behind
 * the Media tab. Publishing *is* the fail-loud gate that used to abort the
 * build (PRD #14): the folder is listed via the Drive API before the row is
 * written, so an unreadable or empty folder is rejected with a flash error and
 * the public site never learns about it.
 */

/**
 * A Drive folder id, either bare or anywhere inside a pasted URL
 * (`…/drive/folders/<id>?usp=sharing`). Ids are url-safe base64-ish; 20+ chars
 * keeps a stray word in a mangled paste from qualifying.
 */
function parseFolderId(raw: string): string | null {
  const fromUrl = /\/folders\/([A-Za-z0-9_-]{10,})/.exec(raw);
  if (fromUrl) return fromUrl[1];
  return /^[A-Za-z0-9_-]{10,}$/.test(raw) ? raw : null;
}

/** The public surfaces a media flip changes, across all three locales. */
function revalidateMediaSurfaces() {
  // Landing (archive card), event detail page (teaser / coming-soon), and the
  // gallery route itself (exists ↔ 404). Route-pattern form covers pl/en/ua in
  // one call each — the `revalidateStartList` idiom.
  revalidatePath("/[locale]", "page");
  revalidatePath("/[locale]/events/[slug]", "page");
  revalidatePath("/[locale]/events/[slug]/gallery", "page");
}

/**
 * Publish (or re-publish) an event's gallery from a Drive folder. Re-running
 * with the same folder is the "re-sync" affordance: it refreshes the stored
 * cover and counts after the photographer adds files.
 */
export async function publishEventMedia(formData: FormData): Promise<void> {
  const locale = safeLocale(formData.get("locale"));
  await requireAdmin(locale, "edit");

  const slug = String(formData.get("slug") ?? "").trim();
  const mediaPage = adminPath(locale, `/events/${slug}/media`);

  const event = await getEventBySlug(slug);
  // Completed individual events only — the same predicate the mailing and the
  // public pages apply, enforced server-side so a crafted post can't publish a
  // gallery for a race that hasn't run.
  if (!event || event.eventType !== "individual" || event.status !== "completed") {
    redirect(`${mediaPage}?error=input`);
  }

  const folderId = parseFolderId(String(formData.get("folder") ?? "").trim());
  if (!folderId) {
    redirect(`${mediaPage}?error=mediafolder`);
  }

  // The fail-loud gate: list the folder now, exactly as the public pages will.
  // An empty listing is rejected too — publishing nothing is a misconfigured
  // share (wrong folder, or the files aren't shared), not a gallery.
  let items;
  try {
    items = await listEventMedia(folderId);
  } catch (error) {
    console.error(`[media] publish listing for ${slug} failed:`, error);
    redirect(`${mediaPage}?error=mediafolder`);
  }
  if (items.length === 0) {
    redirect(`${mediaPage}?error=mediafolder`);
  }

  const photos = items.filter((i) => i.kind === "photo");
  const cover = photos[0] ?? null;
  await getDb()
    .insert(eventMedia)
    .values({
      eventSlug: slug,
      driveFolderId: folderId,
      coverFileId: cover?.id ?? null,
      photoCount: photos.length,
      videoCount: items.length - photos.length,
    })
    .onConflictDoUpdate({
      target: eventMedia.eventSlug,
      set: {
        driveFolderId: folderId,
        coverFileId: cover?.id ?? null,
        photoCount: photos.length,
        videoCount: items.length - photos.length,
        updatedAt: new Date(),
      },
    });

  revalidateMediaSurfaces();
  redirect(
    `${mediaPage}?ok=mediapublished&photos=${photos.length}&videos=${items.length - photos.length}`,
  );
}

/** Take an event's gallery down: the public pages revert to "coming soon". */
export async function unpublishEventMedia(formData: FormData): Promise<void> {
  const locale = safeLocale(formData.get("locale"));
  await requireAdmin(locale, "edit");

  const slug = String(formData.get("slug") ?? "").trim();
  const mediaPage = adminPath(locale, `/events/${slug}/media`);
  if (!(await getEventBySlug(slug))) {
    redirect(`${mediaPage}?error=input`);
  }

  await getDb().delete(eventMedia).where(eq(eventMedia.eventSlug, slug));

  revalidateMediaSurfaces();
  redirect(`${mediaPage}?ok=mediaunpublished`);
}
