"use client";

/* eslint-disable @next/next/no-img-element -- Grid/lightbox images are Drive-
 * hosted and pre-sized via the `sz` param (Drive is the CDN, PRD #14). Routing
 * them through next/image would re-optimize at request time and defeat that. */

import { useCallback, useEffect, useState } from "react";

import {
  GALLERY_LARGE_SIZE,
  GALLERY_THUMB_SIZE,
  driveDownloadUrl,
  drivePreviewUrl,
  driveThumbUrl,
} from "@/lib/events/drive-urls";
import type { EventMediaItem } from "@/lib/events/types";

type Labels = {
  photos: string;
  videos: string;
  download: string;
  close: string;
  prev: string;
  next: string;
  playVideo: string;
};

type Props = {
  /** The full, filename-ordered media list. The lightbox indexes into it. */
  items: EventMediaItem[];
  labels: Labels;
};

/** Minimum horizontal travel (px) to count a touch as a swipe. */
const SWIPE_THRESHOLD = 40;

export function GalleryLightbox({ items, labels }: Props) {
  // Index into the flat `items` array, or null when the lightbox is closed.
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  // Track original indices so grid sections (split by kind) still open the
  // right entry in the flat navigation order.
  const photos = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.kind === "photo");
  const videos = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.kind === "video");

  const close = useCallback(() => setOpenIndex(null), []);
  const step = useCallback(
    (delta: number) =>
      setOpenIndex((current) => {
        if (current === null) return current;
        const next = current + delta;
        if (next < 0 || next >= items.length) return current;
        return next;
      }),
    [items.length],
  );

  // Keyboard navigation + body scroll lock while open.
  useEffect(() => {
    if (openIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "ArrowRight") step(1);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [openIndex, close, step]);

  const active = openIndex === null ? null : items[openIndex];

  return (
    <>
      {photos.length > 0 && (
        <section className="gallery-section">
          <h2 className="gallery-section__h">{labels.photos}</h2>
          <ul className="gallery-grid">
            {photos.map(({ item, index }) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="gallery-cell"
                  onClick={() => setOpenIndex(index)}
                  aria-label={item.name}
                >
                  <img
                    src={driveThumbUrl(item.id, GALLERY_THUMB_SIZE)}
                    alt={item.name}
                    loading="lazy"
                  />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {videos.length > 0 && (
        <section className="gallery-section">
          <h2 className="gallery-section__h">{labels.videos}</h2>
          <ul className="gallery-grid">
            {videos.map(({ item, index }) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="gallery-cell gallery-cell--video"
                  onClick={() => setOpenIndex(index)}
                  aria-label={`${labels.playVideo}: ${item.name}`}
                >
                  <img
                    src={driveThumbUrl(item.id, GALLERY_THUMB_SIZE)}
                    alt={item.name}
                    loading="lazy"
                  />
                  <span className="gallery-play" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {active && (
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={active.name}
          onClick={close}
          onTouchStart={(e) => {
            touchStartX = e.changedTouches[0]?.clientX ?? null;
          }}
          onTouchEnd={(e) => {
            if (touchStartX === null) return;
            const dx = (e.changedTouches[0]?.clientX ?? touchStartX) - touchStartX;
            if (Math.abs(dx) >= SWIPE_THRESHOLD) step(dx < 0 ? 1 : -1);
            touchStartX = null;
          }}
        >
          <button
            type="button"
            className="lightbox__btn lightbox__close"
            onClick={close}
            aria-label={labels.close}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>

          {openIndex !== null && openIndex > 0 && (
            <button
              type="button"
              className="lightbox__btn lightbox__nav lightbox__nav--prev"
              onClick={(e) => {
                e.stopPropagation();
                step(-1);
              }}
              aria-label={labels.prev}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
          {openIndex !== null && openIndex < items.length - 1 && (
            <button
              type="button"
              className="lightbox__btn lightbox__nav lightbox__nav--next"
              onClick={(e) => {
                e.stopPropagation();
                step(1);
              }}
              aria-label={labels.next}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}

          <div className="lightbox__stage" onClick={(e) => e.stopPropagation()}>
            {active.kind === "photo" ? (
              <img
                className="lightbox__img"
                src={driveThumbUrl(active.id, GALLERY_LARGE_SIZE)}
                alt={active.name}
              />
            ) : (
              <div className="lightbox__video">
                <iframe
                  src={drivePreviewUrl(active.id)}
                  title={active.name}
                  allow="autoplay; fullscreen"
                  allowFullScreen
                />
              </div>
            )}
            {active.kind === "photo" && (
              <a
                className="btn btn-red btn-sm lightbox__download"
                href={driveDownloadUrl(active.id)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
              >
                {labels.download}
              </a>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// Module-scoped swipe anchor — one lightbox is open at a time, so a shared
// value avoids a re-render-per-touch that state would cause.
let touchStartX: number | null = null;
