import type { ReactNode } from "react";

/**
 * Anchor for admin file-download endpoints (xlsx route handlers). A plain
 * `<a>` on purpose: `<Link>` client navigation and viewport prefetch are
 * wrong for downloads.
 *
 * `className` defaults to the landing `.btn` family the not-yet-redesigned
 * pages are built from; redesigned surfaces pass `adminButton()` instead, so
 * one component serves both styling idioms while they coexist (ADR 0004).
 */
export function DownloadLink({
  href,
  className = "btn btn-stroke btn-sm",
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a href={href} className={className}>
      {children}
    </a>
  );
}
