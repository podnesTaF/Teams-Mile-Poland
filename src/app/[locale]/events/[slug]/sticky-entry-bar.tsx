"use client";

import { useEffect, useState, type ReactNode } from "react";

type Props = {
  /** `id` of the entry card the bar stands in for; the bar hides while it is on screen. */
  watchId: string;
  children: ReactNode;
};

/**
 * The register CTA pinned to the bottom of a phone screen (event-detail.css
 * shows it under 860px and nowhere else). It stays out of the way while the
 * entry card itself is visible and slides in once the card has scrolled off,
 * so the way to enter is one tap away from every part of the page.
 *
 * Starts hidden: the card is directly under the hero, so on most phones it is
 * on screen at first paint and the bar would otherwise flash in and out. The
 * observer is the only thing that ever shows it, so without a card to watch
 * (or without IntersectionObserver, which every phone browser has had since
 * 2019) the page simply has no bar — the entry card is still right there.
 */
export function StickyEntryBar({ watchId, children }: Props) {
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    const card = document.getElementById(watchId);
    if (!card || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setHidden(entry?.isIntersecting ?? false),
      // The bar itself covers the bottom ~80px, so the card counts as visible
      // only once it has cleared that strip.
      { rootMargin: "0px 0px -80px 0px", threshold: 0.15 },
    );
    observer.observe(card);
    return () => observer.disconnect();
  }, [watchId]);

  return (
    <div className="evd-bar" data-hidden={hidden ? "" : undefined} data-entry-bar>
      {children}
    </div>
  );
}
