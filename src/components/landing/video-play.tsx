"use client";

import { useEffect, useState } from "react";

import { PlayIcon } from "./icons";

type VideoPlayProps = {
  label: string;
  videoId: string;
};

/**
 * The format-band "How it was" play control. Clicking it opens a
 * fullscreen lightbox with the YouTube embed (autoplay). Esc or an
 * overlay/close click dismisses it; body scroll is locked while open.
 */
export function VideoPlay({ label, videoId }: VideoPlayProps) {
  const [open, setOpen] = useState(false);

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
      <button type="button" className="play" onClick={() => setOpen(true)} aria-label={label}>
        <span className="play__circle">
          <PlayIcon />
        </span>
        <span>{label}</span>
      </button>

      {open ? (
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
      ) : null}
    </>
  );
}
