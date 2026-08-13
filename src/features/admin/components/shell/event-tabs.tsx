"use client";

import { useSelectedLayoutSegment } from "next/navigation";

import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * The Roster / Heats / Check-in / Results tab bar shared by the per-event
 * pages, replacing the cross-link button clusters each of them used to carry.
 *
 * Active state comes from `useSelectedLayoutSegment`, which reports the child
 * segment of the event layout this bar lives in — `null` on the roster (the
 * layout's own page), `"heats"`, `"checkin"`. That is locale-prefix proof, so
 * the same component is correct under `/admin`, `/en/admin` and `/ua/admin`
 * without any pathname arithmetic. It also updates the moment a navigation
 * starts, so the tab highlights while the tab content is still shimmering.
 *
 * `data-admin-tab` / `data-active` are stable markers for end-to-end checks.
 */

const TABS = [
  /** The layout's own page: no child segment is selected. */
  { key: "roster", label: "Roster", segment: null, suffix: "" },
  { key: "heats", label: "Heats", segment: "heats", suffix: "/heats" },
  { key: "checkin", label: "Check-in", segment: "checkin", suffix: "/checkin" },
  { key: "results", label: "Results", segment: "results", suffix: "/results" },
] as const;

export function AdminEventTabs({ slug }: { slug: string }) {
  const selected = useSelectedLayoutSegment();

  return (
    <nav
      aria-label="Event sections"
      className="admin-scroll mt-4 flex gap-1 overflow-x-auto border-b border-admin-line"
    >
      {TABS.map((tab) => {
        const active = tab.segment === selected;
        return (
          <Link
            key={tab.key}
            href={`/admin/events/${slug}${tab.suffix}`}
            data-admin-tab={tab.key}
            data-active={active ? "true" : "false"}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-3.5 py-2.5 font-sans text-[13.5px] font-medium normal-case not-italic leading-tight transition-colors",
              active
                ? "border-admin-accent text-admin-ink"
                : "border-transparent text-admin-muted hover:text-admin-ink",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
