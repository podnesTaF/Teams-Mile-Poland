"use client";

import { useEffect } from "react";

/**
 * Scroll-driven parallax for a handful of decorative landing elements. Each
 * target's vertical position is nudged by `--py` (consumed by its CSS
 * `transform`) as it passes through the viewport, so it drifts at a different
 * speed than the foreground.
 *
 *  - `.format-stage .logo-wm--mark` — the ACE BATTLE watermark behind the
 *    athlete on the format band.
 *  - `.tri-up` — the triangle graphic behind the "What is" cards.
 *
 * `range` is the peak drift in px (element travels roughly ±range/2 across a
 * full viewport pass). Disabled under reduced-motion; degrades to `--py: 0`
 * (the CSS fallback) when this component never runs.
 */
const TARGETS = [
  { selector: ".format-stage .logo-wm--mark", range: 80 },
  { selector: ".tri-up", range: 64 },
] as const;

export function Parallax() {
  useEffect(() => {
    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const root = document.querySelector<HTMLElement>(".ace-landing");
    if (!root) return;

    let raf = 0;
    const update = () => {
      raf = 0;
      const vh = window.innerHeight || 1;
      for (const { selector, range } of TARGETS) {
        // Re-query each pass so locale switches / HMR re-mounts stay bound.
        root.querySelectorAll<HTMLElement>(selector).forEach((el) => {
          const rect = el.getBoundingClientRect();
          const center = rect.top + rect.height / 2;
          // -0.5 (above) → +0.5 (below) as the element crosses the viewport.
          const frac = (center - vh / 2) / vh;
          el.style.setProperty("--py", `${(-frac * range).toFixed(1)}px`);
        });
      }
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return null;
}
