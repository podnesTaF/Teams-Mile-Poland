import { resolveFlash, type FlashContext, type FlashQuery } from "@/features/admin/flash";

import { FlashBanner } from "./flash-banner";

/**
 * Action feedback for an admin page: hand it the page's `searchParams` and it
 * renders the one banner that query deserves — or nothing at all.
 *
 * The lookup runs here, on the server, against the shared registry in
 * `flash.ts`; the client island underneath only knows a tone and a sentence.
 * An unknown code, an empty `?msg=`, or a plain page load all resolve to
 * `null`, so nothing is rendered rather than an empty banner.
 *
 * The banner's `key` is fresh per request on purpose. Client state survives a
 * server-action round-trip, and pressing the same button twice redirects to a
 * URL identical to the current one — without a new key the second press would
 * land on a banner the admin had already dismissed and show nothing. The cost
 * is that *any* re-render of this server component brings a dismissed banner
 * back; nothing in the admin re-renders a page without a fresh action (there is
 * no `router.refresh()` anywhere under `/admin`), so a repeated press is the
 * case worth optimising for.
 */
export function AdminFlash({
  query,
  context,
}: {
  query: FlashQuery;
  context?: FlashContext;
}) {
  const flash = resolveFlash(query, context);
  if (!flash) return null;

  return <FlashBanner key={crypto.randomUUID()} tone={flash.tone} message={flash.message} />;
}
