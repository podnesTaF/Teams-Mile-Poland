"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import type { AdminNav } from "./admin-nav";
import { AdminSidebar } from "./admin-sidebar";

/**
 * The client half of the admin shell: it owns the one piece of shell state
 * (is the mobile drawer open?) and lays the sidebar out beside the content
 * column.
 *
 * It has to be a client component so the drawer can open, but `children` are
 * the server-rendered pages passed straight through — nothing about a page is
 * pulled into the client bundle by living inside it. The drawer toggle lives
 * in the topbar, which each page renders, so the state is shared through
 * context rather than props.
 *
 * The drawer closes from the events that dismiss it — a nav link, the scrim,
 * Escape — rather than from an effect watching the pathname, so there is no
 * cascading render on every navigation.
 */

type AdminShellState = {
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
};

const AdminShellContext = createContext<AdminShellState | null>(null);

export function useAdminShell(): AdminShellState {
  const ctx = useContext(AdminShellContext);
  if (!ctx) throw new Error("useAdminShell must be used inside the admin layout");
  return ctx;
}

export function AdminShellFrame({ nav, children }: { nav: AdminNav; children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!drawerOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setDrawerOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen]);

  const value = useMemo<AdminShellState>(
    () => ({
      drawerOpen,
      openDrawer: () => setDrawerOpen(true),
      closeDrawer: () => setDrawerOpen(false),
    }),
    [drawerOpen],
  );

  return (
    <AdminShellContext.Provider value={value}>
      <AdminSidebar nav={nav} open={drawerOpen} onClose={value.closeDrawer} />
      <div className="flex min-w-0 flex-1 flex-col lg:pl-[264px]">{children}</div>
    </AdminShellContext.Provider>
  );
}
