"use client";

import { Search } from "lucide-react";
import { useEffect, useState } from "react";

import { deskButton, deskInput } from "./desk-ui";

/**
 * The desk's search field, which stays on screen while the page scrolls.
 *
 * Sticky because of how the desk is actually used: a runner arrives, you search,
 * you press, the next runner arrives — and between those you are scrolling the
 * waiting list and the heat card. Having to scroll back to the top for every
 * arrival is the single worst thing about using the old desk on a phone.
 *
 * Plain `method="get"`, so the search is a URL and the whole page is a
 * server-rendered result — the mechanics of the old form, unchanged.
 *
 * **Why this is a client component at all:** it sticks *below* the admin topbar,
 * which is itself sticky, so it needs that topbar's height as its offset — and
 * the topbar has no fixed height (its page actions wrap on narrow screens, which
 * makes it two rows). So the offset is measured from the real element and kept in
 * step with a `ResizeObserver`. The server-rendered HTML is already sticky at
 * `--admin-topbar-h`, the topbar's resting height, so the field is correctly
 * placed before this ever runs and only gets *more* correct afterwards.
 */
export function DeskSearch({ query }: { query: string }) {
  const [topbarHeight, setTopbarHeight] = useState<number | null>(null);

  useEffect(() => {
    const topbar = document.querySelector<HTMLElement>("[data-admin-topbar]");
    if (!topbar) return;
    const measure = () => setTopbarHeight(topbar.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(topbar);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      data-admin-desk-search
      style={topbarHeight === null ? undefined : { top: topbarHeight }}
      // Bled out to the content column's edges so the list underneath scrolls
      // *under* an opaque bar rather than past its sides.
      className="sticky top-[var(--admin-topbar-h)] z-20 -mx-4 bg-admin-bg px-4 py-3 sm:-mx-6 sm:px-6"
    >
      <form method="get" className="flex items-end gap-2">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Search by name, email or bib, or paste a ticket link</span>
          <span className="relative block">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-admin-muted"
            />
            <input
              className={deskInput("pl-9")}
              name="q"
              defaultValue={query}
              placeholder="Name, email, bib, or paste ticket link"
              autoFocus
            />
          </span>
        </label>
        <button type="submit" className={deskButton("primary")}>
          Find
        </button>
      </form>
    </div>
  );
}
