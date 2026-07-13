import type { EventMediaItem, EventMediaKind } from "./types";

/**
 * Build-time Google Drive media source. Reads a completed event's public
 * ("anyone with link") Drive folder via Drive API v3 `files.list` with a plain
 * API key (`GOOGLE_DRIVE_API_KEY`) — no OAuth, no service account. Called only
 * from the statically-generated gallery page, so the listing is baked into the
 * build and never runs at request time.
 *
 * Fail-loud policy (PRD #14): any listing failure for a configured folder
 * throws and aborts the build, so a misconfigured share can never silently ship
 * an empty gallery. A completed event with no `media` field is the only
 * "no gallery" state, and that never reaches this function.
 */

const DRIVE_FILES_ENDPOINT = "https://www.googleapis.com/drive/v3/files";

/** Fields we ask Drive for — id/name/mime plus dimensions when available. */
const DRIVE_FIELDS =
  "nextPageToken,files(id,name,mimeType,imageMediaMetadata(width,height),videoMediaMetadata(width,height))";

type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  imageMediaMetadata?: { width?: number; height?: number };
  videoMediaMetadata?: { width?: number; height?: number };
};

type DriveListResponse = {
  files?: DriveFile[];
  nextPageToken?: string;
};

/**
 * List a folder's photos and videos, sorted by filename (shooting order).
 * Filters to `image/*` and `video/*` MIME types; other files (a stray PDF,
 * shortcuts) are ignored. Throws on any HTTP or transport failure.
 */
export async function listEventMedia(driveFolderId: string): Promise<EventMediaItem[]> {
  const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GOOGLE_DRIVE_API_KEY is not set — cannot list event media (fail-loud policy).",
    );
  }

  const files: DriveFile[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(DRIVE_FILES_ENDPOINT);
    url.searchParams.set("q", `'${driveFolderId}' in parents and trashed = false`);
    url.searchParams.set("key", apiKey);
    url.searchParams.set("fields", DRIVE_FIELDS);
    url.searchParams.set("orderBy", "name_natural");
    url.searchParams.set("pageSize", "1000");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    // Default caching keeps the fetch build-time (SSG); `no-store` would force
    // the gallery route dynamic, which we explicitly do not want.
    let res: Response;
    try {
      res = await fetch(url);
    } catch (cause) {
      throw new Error(`Drive listing failed for folder ${driveFolderId}: request error`, {
        cause,
      });
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `Drive listing failed for folder ${driveFolderId}: ${res.status} ${res.statusText} ${body}`.trim(),
      );
    }

    const json = (await res.json()) as DriveListResponse;
    files.push(...(json.files ?? []));
    pageToken = json.nextPageToken;
  } while (pageToken);

  const items = files
    .map(toMediaItem)
    .filter((item): item is EventMediaItem => item !== null);

  // Belt-and-suspenders: Drive `name_natural` orders server-side, but re-sort
  // locally so order is deterministic regardless of the API's collation.
  items.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  return items;
}

/** Map a Drive file to a media item, or null for unsupported MIME types. */
function toMediaItem(file: DriveFile): EventMediaItem | null {
  const kind = mediaKind(file.mimeType);
  if (!kind) return null;
  const meta = kind === "photo" ? file.imageMediaMetadata : file.videoMediaMetadata;
  return {
    id: file.id,
    name: file.name,
    kind,
    width: meta?.width,
    height: meta?.height,
  };
}

function mediaKind(mimeType: string | undefined): EventMediaKind | null {
  if (mimeType?.startsWith("image/")) return "photo";
  if (mimeType?.startsWith("video/")) return "video";
  return null;
}
