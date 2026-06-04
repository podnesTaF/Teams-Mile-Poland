"use client";

import { useEffect } from "react";

/**
 * Scroll-reveal driver for the landing page.
 *
 * Each section's content lives inside a `.wrap` (which never carries a
 * background — those sit on the section root or coloured boxes), so we can
 * safely fade + rise the `.wrap` content as it enters the viewport without
 * disturbing the white→red bleed transitions between sections.
 *
 * The hidden/animated state is defined in CSS, gated behind `.reveal-ready`
 * on the landing root (set in markup, with a <noscript> fallback) so the
 * page degrades to fully-visible without JS. This component just toggles
 * `.is-in` on each `.wrap` once it scrolls into view.
 */
export function ScrollReveal() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".ace-landing");
    if (!root) return;

    const targets = Array.from(root.querySelectorAll<HTMLElement>(".wrap"));

    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Reduced motion or no IntersectionObserver: reveal everything at once.
    if (reduced || typeof IntersectionObserver === "undefined") {
      targets.forEach((el) => el.classList.add("is-in"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-in");
        }
      },
      // Trigger a touch before the element is fully on-screen.
      { rootMargin: "0px 0px -12% 0px", threshold: 0.12 },
    );

    // (Re-)observe every .wrap. Re-observing forces the IO callback to fire
    // with the current intersection state, so a wrap that is already on
    // screen but lost its `is-in` class gets it back immediately.
    const observeAll = () => {
      observer.disconnect();
      root
        .querySelectorAll<HTMLElement>(".wrap")
        .forEach((el) => observer.observe(el));
    };
    // Anything already in view on load (e.g. the hero) reveals immediately
    // on the next frame so it reads as an entrance rather than a flash.
    observeAll();

    // React re-renders (HMR in dev, locale switches in prod) re-apply the
    // server-rendered `className="wrap …"`, clobbering the imperatively
    // added `is-in` — and can also mount brand-new wraps the observer has
    // never seen. Watch for both and resync, debounced to one rAF.
    let scheduled = 0;
    const resync = () => {
      scheduled = 0;
      observeAll();
    };
    const mutations = new MutationObserver(() => {
      if (!scheduled) scheduled = requestAnimationFrame(resync);
    });
    mutations.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      mutations.disconnect();
      observer.disconnect();
      if (scheduled) cancelAnimationFrame(scheduled);
    };
  }, []);

  return null;
}
