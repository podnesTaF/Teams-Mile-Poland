"use client";

import { useSelectedLayoutSegment } from "next/navigation";

import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * The Roster / Heats / Check-in / Teams / Results / Media / Settings tab bar
 * shared by the per-event pages, replacing the cross-link button clusters each
 * of them used to carry.
 *
 * Active state comes from `useSelectedLayoutSegment`, which reports the child
 * segment of the event layout this bar lives in — `null` on the roster (the
 * layout's own page), `"heats"`, `"checkin"`. That is locale-prefix proof, so
 * the same component is correct under `/admin`, `/en/admin` and `/ua/admin`
 * without any pathname arithmetic. It also updates the moment a navigation
 * starts, so the tab highlights while the tab content is still shimmering.
 *
 * **Which tabs a night has depends on its type** (PRD #64). A `team` event gets
 * Teams — the entries list and the composition desk — and loses Results and
 * Media, which have no team flow yet: results, stage times and levels are the
 * next PRD, and a team night has no gallery mailing. An `individual` event is
 * exactly what it was. The decision arrives as a plain boolean, like `canEdit`:
 * this is a client component and must not import the event store or the role
 * helpers itself (same reason `buildAdminNav` filters server-side).
 *
 * `data-admin-tab` / `data-active` are stable markers for end-to-end checks.
 */

const TABS = [
  /** The layout's own page: no child segment is selected. */
  { key: "roster", label: "Roster", segment: null, suffix: "" },
  { key: "heats", label: "Heats", segment: "heats", suffix: "/heats" },
  { key: "checkin", label: "Check-in", segment: "checkin", suffix: "/checkin" },
  /**
   * Team events only. Gated on nothing beyond the admin gate itself: the page
   * behind it renders for `view` (an `admin_viewer` may read the entries list),
   * and its presses gate themselves — the same rule the Check-in tab follows.
   */
  { key: "teams", label: "Teams", segment: "teams", suffix: "/teams", only: "team" },
  { key: "results", label: "Results", segment: "results", suffix: "/results", only: "individual" },
  { key: "media", label: "Media", segment: "media", suffix: "/media", only: "individual" },
  /**
   * `personal_data`, not `edit`: the statements behind this tab carry a date of
   * birth, a home address, a phone and an emergency contact, and the volunteer
   * check-in role must not be shown a door it would 404 on (ADR 0007).
   */
  {
    key: "statements",
    label: "Statements",
    segment: "statements",
    suffix: "/statements",
    requires: "personal_data",
  },
  /**
   * Last on purpose: the lifecycle control, the edit form and the delete panel
   * are what you reach for once, not the tabs you work the race night from.
   *
   * `requires` because the page behind it asks for `edit`: the panel's rule is
   * that it never offers a door that is locked. The decision is made on the
   * server and arrives as plain booleans — this bar is a client component, so
   * it must not import the role helpers itself, the same reason `buildAdminNav`
   * filters server-side and hands the sidebar finished data.
   */
  {
    key: "settings",
    label: "Settings",
    segment: "settings",
    suffix: "/settings",
    requires: "edit",
  },
] as const;

export function AdminEventTabs({
  slug,
  canEdit,
  canReadPersonalData,
  teamEvent = false,
}: {
  slug: string;
  canEdit: boolean;
  canReadPersonalData: boolean;
  /** `event.eventType === "team"` — decided in the layout, passed as a fact. */
  teamEvent?: boolean;
}) {
  const selected = useSelectedLayoutSegment();
  const allows = (tab: (typeof TABS)[number]) => {
    if ("only" in tab && tab.only !== (teamEvent ? "team" : "individual")) return false;
    if (!("requires" in tab)) return true;
    return tab.requires === "edit" ? canEdit : canReadPersonalData;
  };

  return (
    <nav
      aria-label="Event sections"
      className="admin-scroll mt-4 flex gap-1 overflow-x-auto border-b border-admin-line"
    >
      {TABS.filter(allows).map((tab) => {
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
