"use client";

import Image from "next/image";
import type React from "react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { PlayIcon } from "./icons";

type VideoPlayProps = {
  label: string;
  videoId: string;
  /**
   * `row` — play circle + label side by side (hero format band).
   * `card` — the clip's own YouTube poster frame as a 16:9 tile with the
   * play circle over it and the label along the bottom edge (invite and
   * path sections), so the control reads as a video, not as a button.
   */
  variant?: "stacked" | "row" | "card";
  /**
   * `card` only. Scale applied to the poster frame, for clips YouTube stores
   * with black letterbox bars baked into the thumbnail (a 2.35:1 master in a
   * 16:9 frame). `1 / (1 - 2 * barFraction)` crops the bars away; the clip's
   * subject is centred, so the sides it trims cost nothing.
   */
  posterZoom?: number;
};

/**
 * YouTube's poster frame for a clip. `maxresdefault` is the 1280×720 frame
 * every clip uploaded in HD has; both landing clips do (checked), and Next's
 * optimizer resizes it per viewport so mobile never downloads the full frame.
 */
const posterUrl = (videoId: string) => `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;

/**
 * The landing's play control. Clicking it opens a fullscreen lightbox with
 * the YouTube embed (autoplay). Esc or an overlay/close click dismisses it;
 * body scroll is locked while open.
 */
export function VideoPlay({ label, videoId, variant = "stacked", posterZoom }: VideoPlayProps) {
  const [open, setOpen] = useState(false);
  // Mount-gate the portal so the server render and the first client render
  // agree (document is unavailable during SSR).
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.classList.add("modal-open");
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("modal-open");
    };
  }, [open]);

  return (
    <>
      {variant === "card" ? (
        <button
          type="button"
          className="play play--card"
          style={posterZoom ? ({ "--poster-zoom": posterZoom } as React.CSSProperties) : undefined}
          onClick={() => setOpen(true)}
          aria-label={label}
        >
          <Image
            className="play__poster"
            src={posterUrl(videoId)}
            alt=""
            fill
            sizes="(max-width: 720px) 100vw, 720px"
            aria-hidden
          />
          <span className="play__shade" aria-hidden />
          <span className="play__circle">
            <PlayIcon />
          </span>
          <span className="play__caption">
            <span className="play__kicker">YouTube</span>
            <span className="play__label">{label}</span>
          </span>
        </button>
      ) : (
        <button
          type="button"
          className={variant === "row" ? "play play--row" : "play"}
          onClick={() => setOpen(true)}
          aria-label={label}
        >
          <span className="play__circle">
            <PlayIcon />
          </span>
          <span>{label}</span>
        </button>
      )}

      {open && mounted
        ? createPortal(
            // Portalled to <body> so the fixed overlay escapes the hero's
            // `z-index` / `overflow:hidden` stacking context — otherwise the
            // section cards below paint over it. The `.ace-landing` wrapper
            // is required because every lightbox rule is scoped under it
            // (`.ace-landing .video-lightbox`), and the portal lands outside
            // the page's own `.ace-landing` root.
            <div className="ace-landing">
              <div
                className="video-lightbox"
                onMouseDown={(e) => {
                  if (e.target === e.currentTarget) setOpen(false);
                }}
              >
                <button
                  type="button"
                  className="video-lightbox__close"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                >
                  ×
                </button>
                <div className="video-frame">
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`}
                    title={label}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
