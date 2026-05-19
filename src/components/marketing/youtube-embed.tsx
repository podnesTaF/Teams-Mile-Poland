import { cn } from "@/lib/utils";

type YouTubeEmbedProps = {
  videoId?: string;
  title?: string;
  className?: string;
};

export function YouTubeEmbed({ videoId, title, className }: YouTubeEmbedProps) {
  const isPlaceholder = !videoId || videoId === "PLACEHOLDER";
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
        <iframe
          src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`}
          title={title ?? "Video"}
          className="absolute inset-0 h-full w-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      )}
    </div>
  );
}
