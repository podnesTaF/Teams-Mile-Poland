import type { ReactNode } from "react";
import { setRequestLocale } from "next-intl/server";

import "@/app/landing.css";
import "@/app/admin.css";

import { buildAdminNav } from "@/features/admin/components/shell/admin-nav";
import { AdminShellFrame } from "@/features/admin/components/shell/admin-shell-frame";
import { getUser, userRole } from "@/lib/auth/user-session";

/**
 * The admin application shell, inherited by every page under `/admin`.
 *
 * It contributes the dark root (`.ace-landing .iv` stays so the pages that have
 * not been redesigned yet keep rendering through their frozen `.iv-*` rules —
 * ADR 0004), the admin token set, the grouped sidebar and its mobile drawer.
 * Pages add their own topbar and content column via `AdminPage`.
 *
 * Deliberately *not* a gate: `requireAdmin` stays on every page and server
 * action. A layout is skipped on client-side navigations between its own pages,
 * so guarding here would be a false sense of security — see the parent PRD's
 * auth contract.
 *
 * It does read the session, but only to *filter* the nav: the sidebar offers a
 * role the destinations that role can open, so a view-only admin is never
 * handed a link into a 404. Nothing admin-only is rendered here — the items
 * themselves are literals over the public event registry — and `getUser` is
 * request-cached, so the page's own `requireAdmin` costs no second lookup.
 */
export default async function AdminLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const nav = await buildAdminNav(userRole(await getUser()));

  return (
    <div className="ace-landing iv admin-root">
      <AdminShellFrame nav={nav}>{children}</AdminShellFrame>
    </div>
  );
}
