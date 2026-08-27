import { roleHasCapability, type AdminCapability } from "@/lib/auth/roles";
import { getIndividualEvents } from "@/lib/events/registry";
import type { EventStatus } from "@/lib/events/types";

/**
 * The admin sidebar's navigation model.
 *
 * Built on the server (it reads the event store) and handed to the sidebar as
 * plain data, so the store — and the database driver it now imports — never
 * reach the client bundle.
 *
 * **That is a hard constraint, not a preference.** Events are DB rows now, so
 * this module transitively imports `postgres`, which cannot be bundled for the
 * browser (`fs`/`net`/`tls`). The client sidebar therefore imports only *types*
 * from here — type imports are erased, so they pull nothing in. Adding a single
 * runtime export that the sidebar uses would drag the driver into the client
 * bundle and fail the build. Status *display* helpers live in
 * `event-status-badge.tsx` for exactly this reason.
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
  /**
   * What the destination page's own `requireAdmin` asks for. Items above the
   * signed-in admin's level are dropped by {@link buildAdminNav} rather than
   * rendered into a 404 — the sidebar never offers a door that is locked.
   *
   * Omitted means `"view"`, which every admin level holds.
   */
  capability?: AdminCapability;
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
 *
 * `role` is the signed-in admin's level (`users.role`); the nav is filtered to
 * what that level can actually open. Every admin page but one gates at `view`,
 * so in practice this drops **Scan ticket** for `admin_viewer` — the one
 * destination a view-only admin would otherwise be handed a 404 by. It is a
 * filter on offers, never a gate: each page keeps its own `requireAdmin`.
 *
 * A `null`/unknown role (signed out, or a plain user rendering the layout on
 * the way to the page's own redirect/404) holds no capability at all, so the
 * sidebar comes back empty rather than advertising the panel.
 */
export async function buildAdminNav(role: string | null | undefined): Promise<AdminNav> {
  const events: AdminNavEvent[] = (await getIndividualEvents()).map((event) => ({
    slug: event.slug,
    label: eventLabel(event.date),
    status: event.status,
    href: `/admin/events/${event.slug}`,
  }));

  const groups: AdminNav = [
    {
      label: null,
      items: [
        { label: "Overview", href: "/admin", exact: true },
        // The volunteer's entry point: not per-event, because the ticket QR
        // carries the registration id and the check-in panel resolves the
        // event from the row.
        { label: "Scan ticket", href: "/admin/scan", capability: "checkin" },
      ],
    },
    {
      label: "Events",
      items: [{ label: "All events", href: "/admin/events", exact: true }],
      events,
    },
    {
      label: "People",
      items: [
        { label: "Users", href: "/admin/users" },
        // The duplicates report (task 09). A sibling item rather than something
        // reachable only from the list, because "do we have two accounts for one
        // person" is a question the desk asks on its own, not always while
        // looking at the list. `Users` stays prefix-matched so a user *detail*
        // page keeps it lit; the cost is that both items light up here.
        { label: "Duplicates", href: "/admin/users/duplicates" },
        { label: "Referrals", href: "/admin/referrals" },
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

  const visible = roleHasCapability(role, "view");

  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => roleHasCapability(role, item.capability ?? "view")),
      // The per-event links all point at `view`-gated pages, so they ride on
      // the same check as the group's own items.
      events: visible ? group.events : undefined,
    }))
    // A group whose every item was filtered out would render as a bare heading.
    .filter((group) => group.items.length > 0 || (group.events?.length ?? 0) > 0);
}
