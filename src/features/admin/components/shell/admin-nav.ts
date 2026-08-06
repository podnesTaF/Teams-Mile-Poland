import { getIndividualEvents } from "@/lib/events/registry";
import type { EventStatus } from "@/lib/events/types";

/**
 * The admin sidebar's navigation model.
 *
 * Built on the server (it reads the event registry) and handed to the sidebar
 * as plain data, so the registry — and the results/media payloads it imports —
 * never reach the client bundle.
 *
 * Admin is English-only by convention, so the labels are literals rather than
 * message keys.
 */

export type AdminNavItem = {
  label: string;
  href: string;
  /**
   * Match the pathname exactly instead of by prefix. Set on the two hrefs that
   * are prefixes of other admin routes (`/admin`, `/admin/events`) so a roster
   * page does not light up "All events" as well as its own event.
   */
  exact?: boolean;
};

export type AdminNavEvent = {
  slug: string;
  /** Compact English date, e.g. "8 Aug". */
  label: string;
  status: EventStatus;
  href: string;
};

export type AdminNavGroup = {
  /** `null` renders the items with no group heading (Overview, Mailings, Legacy). */
  label: string | null;
  items: AdminNavItem[];
  /** Per-event links, rendered under the group's items (Events only). */
  events?: AdminNavEvent[];
};

export type AdminNav = AdminNavGroup[];

const EVENT_LABEL = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "Europe/Warsaw",
});

/** "8 Aug" from a registry `YYYY-MM-DD`, noon-anchored like the public formatters. */
function eventLabel(date: string): string {
  return EVENT_LABEL.format(new Date(`${date}T12:00:00+02:00`));
}

/**
 * The grouped sidebar: Overview / Events / People / Content / Mailings /
 * Legacy. Every individual mile event appears under Events regardless of
 * lifecycle state (a completed race night keeps its roster, heats and
 * check-in pages) — the sidebar dims the completed ones rather than hiding
 * them. The frozen team event (`warsaw-2026`) is deliberately *not* in that
 * list: it has no per-event admin pages and gets its own Legacy item.
 */
export function buildAdminNav(): AdminNav {
  const events: AdminNavEvent[] = getIndividualEvents().map((event) => ({
    slug: event.slug,
    label: eventLabel(event.date),
    status: event.status,
    href: `/admin/events/${event.slug}`,
  }));

  return [
    { label: null, items: [{ label: "Overview", href: "/admin", exact: true }] },
    {
      label: "Events",
      items: [{ label: "All events", href: "/admin/events", exact: true }],
      events,
    },
    {
      label: "People",
      items: [
        { label: "Users", href: "/admin/users" },
        { label: "Admins", href: "/admin/admins" },
      ],
    },
    {
      label: "Content",
      items: [
        { label: "News", href: "/admin/news" },
        { label: "Inquiries", href: "/admin/inquiries" },
      ],
    },
    { label: null, items: [{ label: "Mailings", href: "/admin/mailings" }] },
    { label: null, items: [{ label: "Legacy — Warsaw 2026", href: "/admin/legacy" }] },
  ];
}

/** Human label for a lifecycle status, used as the status dot's tooltip. */
export function eventStatusLabel(status: EventStatus): string {
  return status.replaceAll("_", " ");
}
