"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { PlayIcon } from "./icons";

type VideoPlayProps = {
  label: string;
  videoId: string;
  /** `row` — play circle + label side by side (invite section). */
  variant?: "stacked" | "row";
};

/**
 * The format-band "How it was" play control. Clicking it opens a
 * fullscreen lightbox with the YouTube embed (autoplay). Esc or an
 * overlay/close click dismisses it; body scroll is locked while open.
 */
export function VideoPlay({ label, videoId, variant = "stacked" }: VideoPlayProps) {
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
