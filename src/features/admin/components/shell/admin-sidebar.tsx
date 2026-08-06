"use client";

import { ArrowUpRight, X } from "lucide-react";

import { Wordmark } from "@/components/landing/wordmark";
import { Link, usePathname } from "@/i18n/navigation";
import type { EventStatus } from "@/lib/events/types";
import { cn } from "@/lib/utils";

import { AdminEyebrow } from "./admin-eyebrow";
import {
  eventStatusLabel,
  type AdminNav,
  type AdminNavEvent,
  type AdminNavItem,
} from "./admin-nav";

/**
 * The persistent admin sidebar: wordmark, grouped sections, every mile event
 * with a lifecycle dot, and a "View site" link back to the public site.
 *
 * Above the `lg` breakpoint it is a fixed rail the content column is padded
 * around; below it, the same element is an off-canvas drawer opened from the
 * topbar's menu button. One element, two behaviours — so there is no second
 * copy of the nav to keep in sync.
 */

const STATUS_DOT: Record<EventStatus, string> = {
  registration_open: "bg-admin-ok",
  upcoming: "bg-admin-warn",
  registration_closed: "bg-admin-accent",
  completed: "bg-admin-muted",
};

function isActive(pathname: string, href: string, exact = false): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminSidebar({
  nav,
  open,
  onClose,
}: {
  nav: AdminNav;
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();

  return (
    <>
      {/* Drawer scrim — mobile only; the rail is always visible on desktop. */}
      <div
        aria-hidden
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-40 bg-black/60 transition-opacity lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      <aside
        aria-label="Admin sections"
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[264px] flex-col border-r border-admin-line bg-admin-surface",
          "transition-transform duration-200 ease-snappy lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-[60px] shrink-0 items-center justify-between gap-2 border-b border-admin-line px-4">
          <Link
            href="/"
            onClick={onClose}
            className="inline-flex items-center"
            aria-label="ACE BATTLE — public site"
          >
            <Wordmark variant="nav" />
          </Link>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="-mr-1 inline-flex h-8 w-8 items-center justify-center rounded-admin text-admin-muted transition-colors hover:bg-admin-surface-2 hover:text-admin-ink lg:hidden"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <nav className="admin-scroll flex-1 overflow-y-auto px-3 py-4">
          {nav.map((group, index) => (
            <div key={group.label ?? `group-${index}`} className={index > 0 ? "mt-5" : undefined}>
              {group.label ? (
                <AdminEyebrow className="px-3 pb-2">{group.label}</AdminEyebrow>
              ) : null}

              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <NavLink
                      item={item}
                      active={isActive(pathname, item.href, item.exact)}
                      onNavigate={onClose}
                    />
                  </li>
                ))}
              </ul>

              {group.events && group.events.length > 0 ? (
                <ul className="ml-3 mt-1 space-y-0.5 border-l border-admin-line pl-2">
                  {group.events.map((event) => (
                    <li key={event.slug}>
                      <EventLink
                        event={event}
                        active={isActive(pathname, event.href)}
                        onNavigate={onClose}
                      />
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-admin-line px-3 py-3">
          <Link
            href="/"
            onClick={onClose}
            className="flex items-center justify-between rounded-admin px-3 py-2 font-sans text-[13px] font-medium normal-case not-italic text-admin-muted transition-colors hover:bg-admin-surface-2 hover:text-admin-ink"
          >
            View site
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      </aside>
    </>
  );
}

const LINK_BASE =
  "flex items-center gap-2.5 rounded-admin px-3 py-2 font-sans text-[13.5px] font-medium normal-case not-italic leading-tight transition-colors";

function NavLink({
  item,
  active,
  onNavigate,
}: {
  item: AdminNavItem;
  active: boolean;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        LINK_BASE,
        active
          ? "bg-admin-accent-soft text-admin-ink shadow-[inset_2px_0_0_var(--admin-accent)]"
          : "text-admin-ink-2 hover:bg-admin-surface-2 hover:text-admin-ink",
      )}
    >
      {item.label}
    </Link>
  );
}

function EventLink({
  event,
  active,
  onNavigate,
}: {
  event: AdminNavEvent;
  active: boolean;
  onNavigate: () => void;
}) {
  const completed = event.status === "completed";
  return (
    <Link
      href={event.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        LINK_BASE,
        "text-[13px]",
        active
          ? "bg-admin-accent-soft text-admin-ink shadow-[inset_2px_0_0_var(--admin-accent)]"
          : "text-admin-ink-2 hover:bg-admin-surface-2 hover:text-admin-ink",
        // Completed race nights stay reachable but recede, so the operational
        // events are the ones that catch the eye.
        completed && !active && "opacity-60",
      )}
    >
      <span
        aria-hidden
        className={cn("h-1.5 w-1.5 shrink-0 rounded-full", STATUS_DOT[event.status])}
      />
      <span className="truncate">{event.label}</span>
      <span className="sr-only"> — {eventStatusLabel(event.status)}</span>
    </Link>
  );
}
