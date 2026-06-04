import { cn } from "@/lib/utils";

type Props = {
  /** Rendered pixel size (square). Defaults to 120. */
  size?: number;
  className?: string;
  /** Accessible label announced to assistive tech. */
  label?: string;
};

/**
 * Brand loading animation (triangle mosaic). Served as an optimized animated
 * WebP (~290 KB, down from the ~1.9 MB source GIF), with the GIF kept as a
 * fallback for the rare browser without animated-WebP support. The GIF
 * carries its own cream background, so the loader reads as a small rounded
 * tile on any surface.
 *
 * Uses a native <picture>/<img> rather than next/image because next/image
 * can't emit a multi-source <picture>, and its optimizer would freeze the
 * animation to a single frame anyway.
 */
export function Loader({ size = 120, className, label = "Loading…" }: Props) {
  return (
    <picture>
      <source srcSet="/loading.webp" type="image/webp" />
      <img
        src="/loading.gif"
        alt={label}
        width={size}
        height={size}
        className={cn("loader-gif", className)}
      />
    </picture>
  );
}
