/**
 * Pure Google Drive URL builders for a publicly shared ("anyone with link")
 * file or folder. No secrets, no I/O — safe to import into client components so
 * the lightbox can derive thumbnail / large / download / preview URLs from a
 * file id without shipping the build-time listing code (`media.ts`) to the
 * browser. Drive is both the media store and the CDN (see PRD #14): the site
 * never re-hosts a file, it only points at these endpoints.
 */

/** Grid thumbnail edge, in px — small so the mobile grid stays light. */
export const GALLERY_THUMB_SIZE = 600;
/** Lightbox image edge, in px — large enough for full-screen viewing. */
export const GALLERY_LARGE_SIZE = 1600;

/**
 * A sized thumbnail/preview image for a Drive file. Works for images and for
 * videos (returns a poster frame), so it backs both the photo grid and the
 * video play badges. `sz=w<width>` asks Drive to scale to that width.
 */
export function driveThumbUrl(id: string, width: number): string {
  return `https://drive.google.com/thumbnail?id=${id}&sz=w${width}`;
}

/** Direct-download URL for the original file (used by the lightbox download). */
export function driveDownloadUrl(id: string): string {
  return `https://drive.google.com/uc?export=download&id=${id}`;
}

/** Drive's embeddable preview player for a video (iframe src). */
export function drivePreviewUrl(id: string): string {
  return `https://drive.google.com/file/d/${id}/preview`;
}

/** The public folder view — the "open full album on Drive" destination. */
export function driveAlbumUrl(folderId: string): string {
  return `https://drive.google.com/drive/folders/${folderId}`;
}
