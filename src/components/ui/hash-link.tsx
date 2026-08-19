"use client";

import type { ComponentProps, MouseEvent } from "react";

import { Link, usePathname } from "@/i18n/navigation";

type HashLinkProps = Omit<ComponentProps<typeof Link>, "href"> & { href: string };

/**
 * A `<Link>` that still scrolls when its target is a section of the page the
 * visitor is already on.
 *
 * The App Router only scrolls to a `#hash` as part of a *navigation*. Once the
 * hash is in the address bar (say `/#events`, after the header CTA was clicked)
 * a second click is a navigation to the URL we are already at, so the router
 * does nothing — the visitor has scrolled away meanwhile and the button looks
 * dead. Nothing puts the hash back either: we have no scroll-spy, so scrolling
 * past a section never rewrites the URL.
 *
 * So for same-page targets we skip the router and scroll the element into view
 * ourselves, every click. Cross-page hrefs (`/register`, `/events/x#results`
 * from elsewhere) fall through to the normal `<Link>` behaviour.
 *
 * The offset under the fixed header comes from the `scroll-margin-top` rule on
 * `.ace-landing [id]` in `landing.css` — `scrollIntoView` honours it.
 */
export function HashLink({ href, onClick, ...props }: HashLinkProps) {
  const pathname = usePathname();

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (event.defaultPrevented) return;
    // Let the browser own modified clicks (new tab, new window, …).
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (event.button !== 0) return;

    const hashIndex = href.indexOf("#");
    if (hashIndex < 0) return;

    // `usePathname` is locale-stripped, and so is `href` — both are "/" here.
    const targetPath = href.slice(0, hashIndex) || "/";
    if (targetPath !== pathname) return;

    const id = decodeURIComponent(href.slice(hashIndex + 1));
    const target = id ? document.getElementById(id) : null;
    if (!target) return;

    event.preventDefault();
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // A frame later: an `onClick` that closes the mobile drawer only releases
    // `body { overflow: hidden }` once React has committed, and the page can't
    // scroll before that.
    window.requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
      // Keep the address bar honest without pushing a router navigation.
      window.history.replaceState(null, "", `#${id}`);
    });
  }

  return <Link {...props} href={href} onClick={handleClick} />;
}
