"use client";

import { useEffect, useState } from "react";
import YouTube, { type YouTubeEvent, type YouTubePlayer } from "react-youtube";

import { cn } from "@/lib/utils";

type YouTubeEmbedProps = {
  videoId?: string;
  title?: string;
  className?: string;
};

export function YouTubeEmbed({ videoId, title, className }: YouTubeEmbedProps) {
  const isPlaceholder = !videoId || videoId === "PLACEHOLDER";
  const playerTitle = title ?? "Video";
  const [player, setPlayer] = useState<YouTubePlayer | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasEnded, setHasEnded] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  const play = () => {
    setIsActive(true);
    setHasEnded(false);
    void player?.playVideo();
  };

  const pause = () => {
    void player?.pauseVideo();
  };

  const replay = () => {
    setIsActive(true);
    setHasEnded(false);
    void player?.seekTo(0, true);
    void player?.playVideo();
  };

  const handleReady = (event: YouTubeEvent) => {
    setPlayer(event.target);

    if (isActive) {
      void event.target.playVideo();
    }
  };

  const openLightbox = () => {
    void player?.pauseVideo();
    setIsLightboxOpen(true);
  };

  const closeLightbox = () => {
    setIsLightboxOpen(false);
  };

  useEffect(() => {
    if (!isLightboxOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeLightbox();
      }
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isLightboxOpen]);

  return (
    <div
      className={cn(
        "relative mb-6 aspect-video w-full overflow-hidden border border-ink bg-ink",
        className,
      )}
    >
      {isPlaceholder ? (
        <div
          aria-hidden
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-ink text-center text-white"
          style={{
            backgroundImage:
              "repeating-linear-gradient(110deg, transparent 0, transparent 60px, rgba(255,255,255,0.025) 60px, rgba(255,255,255,0.025) 61px)",
          }}
        >
          <span className="mb-1 inline-flex h-14 w-14 items-center justify-center bg-accent pl-1 text-[22px] text-white">
            ▶
          </span>
          <span className="font-display text-lg font-black italic uppercase tracking-tight">
            YouTube video
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/50">
            Coming soon
          </span>
        </div>
      ) : (
        <>
          <YouTube
            videoId={videoId}
            title={playerTitle}
            loading="lazy"
            className="absolute inset-0 h-full w-full"
            iframeClassName="h-full w-full border-0"
            opts={{
              width: "100%",
              height: "100%",
              playerVars: {
                autoplay: isActive ? 1 : 0,
                controls: 0,
                disablekb: 1,
                fs: 0,
                modestbranding: 1,
                rel: 0,
              },
            }}
            onReady={handleReady}
            onPlay={() => {
              setIsPlaying(true);
              setHasEnded(false);
            }}
            onPause={() => setIsPlaying(false)}
            onEnd={() => {
              setIsPlaying(false);
              setHasEnded(true);
            }}
          />

          {!isActive && (
            <button
              type="button"
              onClick={play}
              className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-ink text-center text-white transition-colors hover:bg-ink-2"
              style={{
                backgroundImage: `linear-gradient(rgba(18, 18, 18, 0.45), rgba(18, 18, 18, 0.9)), url(https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg)`,
                backgroundPosition: "center",
                backgroundSize: "cover",
              }}
              aria-label={`Play ${playerTitle}`}
            >
              <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-accent pl-1 text-[24px] text-white shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
                ▶
              </span>
              <span className="font-display text-xl font-black italic uppercase tracking-tight">
                Watch rating video
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={openLightbox}
            className="absolute right-3 top-3 z-20 border border-white/35 bg-ink/75 px-3 py-2 font-display-alt text-[11px] font-semibold uppercase tracking-[0.08em] text-white backdrop-blur transition-colors hover:border-white hover:bg-white hover:text-ink"
            aria-label={`Open ${playerTitle} in lightbox`}
          >
            Expand
          </button>

          {isActive && (
            <div className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-between gap-3 bg-gradient-to-t from-ink via-ink/75 to-transparent px-4 pb-4 pt-12 text-white">
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/65">
                {playerTitle}
              </span>
              <div className="flex items-center gap-2">
                {hasEnded ? (
                  <button
                    type="button"
                    onClick={replay}
                    className="bg-accent px-3 py-2 font-display-alt text-[11px] font-semibold uppercase tracking-[0.08em] text-white transition-colors hover:bg-[#b8302a]"
                  >
                    Replay
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={isPlaying ? pause : play}
                    className="bg-white px-3 py-2 font-display-alt text-[11px] font-semibold uppercase tracking-[0.08em] text-ink transition-colors hover:bg-bg-2"
                  >
                    {isPlaying ? "Pause" : "Play"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={openLightbox}
                  className="border border-white/35 px-3 py-2 font-display-alt text-[11px] font-semibold uppercase tracking-[0.08em] text-white transition-colors hover:border-white hover:bg-white hover:text-ink"
                >
                  Expand
                </button>
                <a
                  href={`https://youtu.be/${videoId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border border-white/35 px-3 py-2 font-display-alt text-[11px] font-semibold uppercase tracking-[0.08em] text-white transition-colors hover:border-white hover:bg-white hover:text-ink"
                >
                  YouTube
                </a>
              </div>
            </div>
          )}

          {isLightboxOpen && (
            <div
              role="dialog"
              aria-modal="true"
              aria-label={playerTitle}
              className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/90 p-4 backdrop-blur-sm md:p-8"
              onClick={closeLightbox}
            >
              <div
                className="relative w-full max-w-6xl border border-white/20 bg-ink shadow-[0_30px_90px_rgba(0,0,0,0.45)]"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-3 text-white">
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/60">
                    {playerTitle}
                  </span>
                  <button
                    type="button"
                    onClick={closeLightbox}
                    className="border border-white/35 px-3 py-2 font-display-alt text-[11px] font-semibold uppercase tracking-[0.08em] text-white transition-colors hover:border-white hover:bg-white hover:text-ink"
                  >
                    Close
                  </button>
                </div>
                <div className="relative aspect-video w-full">
                  <YouTube
                    videoId={videoId}
                    title={`${playerTitle} lightbox`}
                    className="absolute inset-0 h-full w-full"
                    iframeClassName="h-full w-full border-0"
                    opts={{
                      width: "100%",
                      height: "100%",
                      playerVars: {
                        autoplay: 1,
                        controls: 1,
                        modestbranding: 1,
                        rel: 0,
                      },
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
