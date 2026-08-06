"use client";

import { Menu } from "lucide-react";

import { useAdminShell } from "./admin-shell-frame";

/** Opens the sidebar drawer. Hidden once the sidebar is a permanent rail. */
export function AdminMenuButton() {
  const { openDrawer } = useAdminShell();
  return (
    <button
      type="button"
      onClick={openDrawer}
      aria-label="Open menu"
      className="-ml-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-admin text-admin-ink-2 transition-colors hover:bg-admin-surface-2 hover:text-admin-ink lg:hidden"
    >
      <Menu className="h-5 w-5" aria-hidden />
    </button>
  );
}
