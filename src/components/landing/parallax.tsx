"use client";

import { useEffect } from "react";

/**
 * Scroll-driven parallax for decorative landing elements. Offsets are written
 * to `--px` / `--py` and consumed by each target's CSS `transform`.
 *
 * `range` is peak drift in px (roughly ±range/2 across a full viewport pass).
 * `sign` flips drift direction; defaults to -1 for vertical targets.
 * Disabled under reduced-motion; CSS fallbacks to 0 when this never runs.
 */
const TARGETS = [
  { selector: ".format-stage .logo-wm--mark", prop: "--py", range: 80, sign: -1 },
  { selector: ".tri-up", prop: "--py", range: 64, sign: -1 },
  { selector: ".roles__chev", prop: "--px", range: 140, sign: 1 },
  { selector: ".acl-footer__chev--left", prop: "--px", range: 80, sign: -1 },
  { selector: ".acl-footer__chev--right", prop: "--px", range: 80, sign: 1 },
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
      for (const { selector, prop, range, sign } of TARGETS) {
        // Re-query each pass so locale switches / HMR re-mounts stay bound.
        root.querySelectorAll<HTMLElement>(selector).forEach((el) => {
          const rect = el.getBoundingClientRect();
          const center = rect.top + rect.height / 2;
          // -0.5 (above) → +0.5 (below) as the element crosses the viewport.
          const frac = (center - vh / 2) / vh;
          el.style.setProperty(prop, `${(frac * range * sign).toFixed(1)}px`);
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
