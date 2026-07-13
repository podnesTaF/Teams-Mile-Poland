import type { ReactNode } from "react";

/**
 * Anchor for admin file-download endpoints (xlsx route handlers). A plain
 * `<a>` on purpose: `<Link>` client navigation and viewport prefetch are
 * wrong for downloads.
 */
export function DownloadLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} className="btn btn-stroke btn-sm">
      {children}
    </a>
  );
}
